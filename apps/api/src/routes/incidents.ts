import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import {
  UpdateIncidentSchema,
  IncidentResponseSchema,
} from "@pulsestack/shared";
import { incidents } from "@pulsestack/database";

/**
 * Incident read + triage routes for a project.
 * All routes are scoped under /v1/projects/:projectId/incidents
 * and require:
 *   - JWT authentication (fastify.authenticate)
 *   - Project-level access authorization (fastify.authorizeProjectAccess)
 *
 * Incidents are NOT created via the API — they are created programmatically
 * by the alert evaluation engine (Plan 4.4).
 */
const incidentRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // -------------------------------------------------------------------------
  // GET /v1/projects/:projectId/incidents — list incidents (recent first)
  // -------------------------------------------------------------------------
  fastify.get(
    "/:projectId/incidents",
    {
      schema: {
        params: z.object({ projectId: z.string().min(1) }),
        querystring: z.object({
          status: z.enum(["open", "resolved"]).optional(),
          limit: z.coerce.number().int().min(1).max(100).default(50),
        }),
        response: {
          200: z.array(IncidentResponseSchema),
        },
      },
      preHandler: [fastify.authorizeProjectAccess],
    },
    async (request) => {
      const { projectId } = request.params;
      const { status, limit } = request.query;

      const conditions = [eq(incidents.projectId, projectId)];
      if (status) {
        conditions.push(eq(incidents.status, status));
      }

      const rows = await fastify.db
        .select()
        .from(incidents)
        .where(and(...conditions))
        .orderBy(desc(incidents.openedAt))
        .limit(limit);

      return rows.map(mapIncident);
    }
  );

  // -------------------------------------------------------------------------
  // GET /v1/projects/:projectId/incidents/:incidentId — single incident
  // -------------------------------------------------------------------------
  fastify.get(
    "/:projectId/incidents/:incidentId",
    {
      schema: {
        params: z.object({
          projectId: z.string().min(1),
          incidentId: z.string().min(1),
        }),
        response: {
          200: IncidentResponseSchema,
        },
      },
      preHandler: [fastify.authorizeProjectAccess],
    },
    async (request) => {
      const { projectId, incidentId } = request.params;

      const [row] = await fastify.db
        .select()
        .from(incidents)
        .where(and(eq(incidents.id, incidentId), eq(incidents.projectId, projectId)))
        .limit(1);

      if (!row) {
        throw fastify.httpErrors.notFound("Incident not found");
      }

      return mapIncident(row);
    }
  );

  // -------------------------------------------------------------------------
  // PATCH /v1/projects/:projectId/incidents/:incidentId — update notes/status
  // -------------------------------------------------------------------------
  fastify.patch(
    "/:projectId/incidents/:incidentId",
    {
      schema: {
        params: z.object({
          projectId: z.string().min(1),
          incidentId: z.string().min(1),
        }),
        body: UpdateIncidentSchema,
        response: {
          200: IncidentResponseSchema,
        },
      },
      preHandler: [fastify.authorizeProjectAccess],
    },
    async (request) => {
      const { projectId, incidentId } = request.params;
      const { notes, status } = request.body;

      const [existing] = await fastify.db
        .select()
        .from(incidents)
        .where(and(eq(incidents.id, incidentId), eq(incidents.projectId, projectId)))
        .limit(1);

      if (!existing) {
        throw fastify.httpErrors.notFound("Incident not found");
      }

      const updatePayload: Record<string, unknown> = {};
      if (notes !== undefined) updatePayload.notes = notes;
      if (status !== undefined) {
        updatePayload.status = status;
        if (status === "resolved" && !existing.resolvedAt) {
          updatePayload.resolvedAt = new Date();
        }
        if (status === "open") {
          updatePayload.resolvedAt = null;
        }
      }

      const [updated] = await fastify.db
        .update(incidents)
        .set(updatePayload)
        .where(eq(incidents.id, incidentId))
        .returning();

      return mapIncident(updated);
    }
  );
};

// ---------------------------------------------------------------------------
// Mapper: DB row → API response shape
// ---------------------------------------------------------------------------

function mapIncident(row: typeof incidents.$inferSelect) {
  return {
    id: row.id,
    projectId: row.projectId,
    alertRuleId: row.alertRuleId,
    status: row.status as "open" | "resolved",
    title: row.title,
    triggerValue: row.triggerValue,
    notes: row.notes,
    openedAt: row.openedAt,
    resolvedAt: row.resolvedAt,
  };
}

export default incidentRoutes;
