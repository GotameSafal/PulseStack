import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, ilike, or, desc, asc } from "drizzle-orm";
import { users } from "@pulsestack/database";
import { hashPassword } from "../lib/password";

const UserResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  createdAt: z.string().or(z.date()),
});

const userRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /v1/users — list all users (paginated, searchable, sortable)
  fastify.get(
    "/",
    {
      schema: {
        querystring: z.object({
          page:      z.coerce.number().int().min(1).default(1),
          limit:     z.coerce.number().int().min(1).max(100).default(10),
          search:    z.string().optional(),
          sortField: z.enum(["name", "email", "createdAt"]).optional(),
          sortDir:   z.enum(["asc", "desc"]).optional(),
        }),
        response: {
          200: z.object({
            data:       z.array(UserResponseSchema),
            totalCount: z.number(),
          }),
        },
      },
    },
    async (request) => {
      const { page, limit, search, sortField, sortDir } = request.query;

      const baseQuery = fastify.db.select({
        id:        users.id,
        name:      users.name,
        email:     users.email,
        createdAt: users.createdAt,
      }).from(users);

      // Apply search filter
      const filtered = search
        ? baseQuery.where(
            or(
              ilike(users.name, `%${search}%`),
              ilike(users.email, `%${search}%`)
            )
          )
        : baseQuery;

      // Apply sort
      const sortCol =
        sortField === "name"      ? users.name
        : sortField === "email"   ? users.email
        : users.createdAt;

      const sorted = sortDir === "asc"
        ? filtered.orderBy(asc(sortCol))
        : filtered.orderBy(desc(sortCol));

      // Paginate
      const offset = (page - 1) * limit;
      const rows = await sorted.limit(limit).offset(offset);

      // Total count (rerun with just count)
      const countQuery = fastify.db
        .select({ id: users.id })
        .from(users);

      const countFiltered = search
        ? countQuery.where(
            or(
              ilike(users.name, `%${search}%`),
              ilike(users.email, `%${search}%`)
            )
          )
        : countQuery;

      const allRows = await countFiltered;
      const totalCount = allRows.length;

      return {
        data: rows.map((u) => ({
          id:        u.id,
          name:      u.name,
          email:     u.email,
          createdAt: u.createdAt,
        })),
        totalCount,
      };
    }
  );

  // POST /v1/users — create a user
  fastify.post(
    "/",
    {
      schema: {
        body: z.object({
          name:     z.string().min(1),
          email:    z.string().email(),
          password: z.string().min(6).optional().default("changeme123"),
        }),
        response: {
          201: UserResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { name, email, password } = request.body;
      const passwordHash = await hashPassword(password);

      const [newUser] = await fastify.db
        .insert(users)
        .values({ name, email, passwordHash })
        .returning();

      reply.status(201);
      return {
        id:        newUser.id,
        name:      newUser.name,
        email:     newUser.email,
        createdAt: newUser.createdAt,
      };
    }
  );

  // DELETE /v1/users/:id
  fastify.delete(
    "/:id",
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: z.object({ success: z.boolean(), message: z.string() }),
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const [existing] = await fastify.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!existing) {
        throw fastify.httpErrors.notFound("User not found");
      }

      await fastify.db.delete(users).where(eq(users.id, id));
      return { success: true, message: "User deleted successfully" };
    }
  );
};

export default userRoutes;
