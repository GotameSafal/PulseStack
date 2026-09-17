import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import {
  CreateOrganizationSchema,
} from "@pulsestack/shared";
import {
  organizations,
  organizationMembers,
} from "@pulsestack/database";

const organizationRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All endpoints require authentication
  fastify.addHook("onRequest", fastify.authenticate);

  // POST /v1/organizations - create an organization
  fastify.post(
    "/",
    {
      schema: {
        body: CreateOrganizationSchema,
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            slug: z.string(),
            role: z.string(),
            createdAt: z.string().or(z.date()),
          }),
        },
      },
    },
    async (request, reply) => {
      const { name, slug } = request.body;
      const { userId } = request.user;

      // Check if slug already exists
      const [existingOrg] = await fastify.db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      if (existingOrg) {
        throw fastify.httpErrors.conflict("Organization slug already in use");
      }

      const [newOrg] = await fastify.db
        .insert(organizations)
        .values({
          name,
          slug,
        })
        .returning();

      // Add user as OWNER
      await fastify.db.insert(organizationMembers).values({
        organizationId: newOrg.id,
        userId,
        role: "OWNER",
      });

      reply.status(201);
      return {
        id: newOrg.id,
        name: newOrg.name,
        slug: newOrg.slug,
        role: "OWNER",
        createdAt: newOrg.createdAt,
      };
    }
  );

  // GET /v1/organizations - list all organizations for the current user
  fastify.get(
    "/",
    {
      schema: {
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              slug: z.string(),
              role: z.string(),
              createdAt: z.string().or(z.date()),
            })
          ),
        },
      },
    },
    async (request) => {
      const { userId } = request.user;

      const userOrgs = await fastify.db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          role: organizationMembers.role,
          createdAt: organizations.createdAt,
        })
        .from(organizationMembers)
        .innerJoin(
          organizations,
          eq(organizationMembers.organizationId, organizations.id)
        )
        .where(eq(organizationMembers.userId, userId));

      return userOrgs;
    }
  );
};

export default organizationRoutes;
