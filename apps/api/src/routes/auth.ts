import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  RegisterInputSchema,
  LoginInputSchema,
  UserAuthResponseSchema,
} from "@pulsestack/shared";
import {
  users,
  organizations,
  organizationMembers,
} from "@pulsestack/database";
import { hashPassword, verifyPassword } from "../lib/password";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "org";
}

const authRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/register",
    {
      schema: {
        body: RegisterInputSchema,
        response: {
          201: UserAuthResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { name, email, password, organizationName } = request.body;

      // Check if user with email already exists
      const existingUser = await fastify.db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        throw fastify.httpErrors.conflict("User with this email already exists");
      }

      const passwordHash = await hashPassword(password);

      // Create user
      const [newUser] = await fastify.db
        .insert(users)
        .values({
          name,
          email,
          passwordHash,
        })
        .returning();

      // Create default organization
      let baseSlug = slugify(organizationName);
      let slug = baseSlug;
      let counter = 1;
      while (true) {
        const existingOrg = await fastify.db
          .select()
          .from(organizations)
          .where(eq(organizations.slug, slug))
          .limit(1);

        if (existingOrg.length === 0) break;
        slug = `${baseSlug}-${counter++}`;
      }

      const [newOrg] = await fastify.db
        .insert(organizations)
        .values({
          name: organizationName,
          slug,
        })
        .returning();

      // Create membership with OWNER role
      await fastify.db.insert(organizationMembers).values({
        organizationId: newOrg.id,
        userId: newUser.id,
        role: "OWNER",
      });

      const token = fastify.jwt.sign({
        userId: newUser.id,
        email: newUser.email,
      });

      reply.status(201);
      return {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        token,
        activeOrganizationId: newOrg.id,
      };
    }
  );

  fastify.post(
    "/login",
    {
      schema: {
        body: LoginInputSchema,
        response: {
          200: UserAuthResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const [user] = await fastify.db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        throw fastify.httpErrors.unauthorized("Invalid email or password");
      }

      const validPassword = await verifyPassword(password, user.passwordHash);
      if (!validPassword) {
        throw fastify.httpErrors.unauthorized("Invalid email or password");
      }

      // Find first organization the user belongs to
      const [membership] = await fastify.db
        .select({
          organizationId: organizationMembers.organizationId,
        })
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, user.id))
        .limit(1);

      const token = fastify.jwt.sign({
        userId: user.id,
        email: user.email,
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        token,
        activeOrganizationId: membership?.organizationId,
      };
    }
  );

  fastify.get(
    "/me",
    {
      onRequest: [fastify.authenticate],
      schema: {
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
            organizations: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                slug: z.string(),
                role: z.string(),
              })
            ),
          }),
        },
      },
    },
    async (request) => {
      const { userId } = request.user;

      const [user] = await fastify.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw fastify.httpErrors.notFound("User not found");
      }

      // Fetch user's organizations
      const userOrgs = await fastify.db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          role: organizationMembers.role,
        })
        .from(organizationMembers)
        .innerJoin(
          organizations,
          eq(organizationMembers.organizationId, organizations.id)
        )
        .where(eq(organizationMembers.userId, userId));

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        organizations: userOrgs,
      };
    }
  );
};

export default authRoutes;
