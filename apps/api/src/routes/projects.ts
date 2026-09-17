import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import {
  CreateProjectSchema,
  ProjectResponseSchema,
  CreateApiKeySchema,
  ApiKeyResponseSchema,
} from "@pulsestack/shared";
import {
  projects,
  organizationMembers,
  apiKeys,
} from "@pulsestack/database";

const projectRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All endpoints require authentication
  fastify.addHook("onRequest", fastify.authenticate);

  // Helper to verify user is a member of the organization
  const assertOrgMembership = async (organizationId: string, userId: string) => {
    const [membership] = await fastify.db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId)
        )
      )
      .limit(1);

    if (!membership) {
      throw fastify.httpErrors.forbidden("You do not have access to this organization");
    }

    return membership;
  };

  // POST /v1/projects - create a project
  fastify.post(
    "/",
    {
      schema: {
        body: CreateProjectSchema,
        response: {
          201: ProjectResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { organizationId, name, slug, environment } = request.body;
      const { userId } = request.user;

      await assertOrgMembership(organizationId, userId);

      // Check if project slug already exists within organization
      const [existingProject] = await fastify.db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, organizationId),
            eq(projects.slug, slug)
          )
        )
        .limit(1);

      if (existingProject) {
        throw fastify.httpErrors.conflict("Project slug already in use in this organization");
      }

      const [newProject] = await fastify.db
        .insert(projects)
        .values({
          organizationId,
          name,
          slug,
          environment,
        })
        .returning();

      reply.status(201);
      return {
        id: newProject.id,
        organizationId: newProject.organizationId,
        name: newProject.name,
        slug: newProject.slug,
        environment: newProject.environment as any,
        createdAt: newProject.createdAt,
      };
    }
  );

  // GET /v1/projects - list projects for an organization
  fastify.get(
    "/",
    {
      schema: {
        querystring: z.object({
          organizationId: z.string().min(1, "Organization ID is required"),
        }),
        response: {
          200: z.array(ProjectResponseSchema),
        },
      },
    },
    async (request) => {
      const { organizationId } = request.query;
      const { userId } = request.user;

      await assertOrgMembership(organizationId, userId);

      const orgProjects = await fastify.db
        .select()
        .from(projects)
        .where(eq(projects.organizationId, organizationId));

      return orgProjects.map((p) => ({
        id: p.id,
        organizationId: p.organizationId,
        name: p.name,
        slug: p.slug,
        environment: p.environment as any,
        createdAt: p.createdAt,
      }));
    }
  );

  // POST /v1/projects/:id/api-keys - generate an API key
  fastify.post(
    "/:id/api-keys",
    {
      schema: {
        params: z.object({
          id: z.string().min(1),
        }),
        body: z.object({
          name: z.string().min(2, "API key label must be at least 2 characters"),
          rateLimitTier: z.enum(["standard", "pro", "enterprise"]).default("standard"),
        }),
        response: {
          201: ApiKeyResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id: projectId } = request.params;
      const { name, rateLimitTier } = request.body;
      const { userId } = request.user;

      // Find project
      const [project] = await fastify.db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) {
        throw fastify.httpErrors.notFound("Project not found");
      }

      await assertOrgMembership(project.organizationId, userId);

      // Generate secret key: ps_live_<random hex>
      const randomSecret = crypto.randomBytes(24).toString("hex");
      const secretKey = `ps_live_${randomSecret}`;
      const keyPrefix = secretKey.slice(0, 16); // e.g. ps_live_12345678
      const keyHash = crypto.createHash("sha256").update(secretKey).digest("hex");

      const [newKey] = await fastify.db
        .insert(apiKeys)
        .values({
          projectId,
          name,
          keyPrefix,
          keyHash,
          rateLimitTier,
        })
        .returning();

      reply.status(201);
      return {
        id: newKey.id,
        projectId: newKey.projectId,
        name: newKey.name,
        keyPrefix: newKey.keyPrefix,
        secretKey, // Return plaintext secret key ONCE on creation
        rateLimitTier: newKey.rateLimitTier,
        lastUsedAt: newKey.lastUsedAt,
        createdAt: newKey.createdAt,
      };
    }
  );

  // DELETE /v1/projects/:id/api-keys/:keyId - revoke an API key
  fastify.delete(
    "/:id/api-keys/:keyId",
    {
      schema: {
        params: z.object({
          id: z.string().min(1),
          keyId: z.string().min(1),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const { id: projectId, keyId } = request.params;
      const { userId } = request.user;

      const [project] = await fastify.db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) {
        throw fastify.httpErrors.notFound("Project not found");
      }

      await assertOrgMembership(project.organizationId, userId);

      const [apiKey] = await fastify.db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.id, keyId), eq(apiKeys.projectId, projectId)))
        .limit(1);

      if (!apiKey) {
        throw fastify.httpErrors.notFound("API key not found");
      }

      await fastify.db.delete(apiKeys).where(eq(apiKeys.id, keyId));

      return {
        success: true,
        message: "API key revoked successfully",
      };
    }
  );
};

export default projectRoutes;
