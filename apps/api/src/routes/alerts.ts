import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import {
  CreateAlertRuleSchema,
  UpdateAlertRuleSchema,
  AlertRuleResponseSchema,
} from "@pulsestack/shared";
import { alertRules } from "@pulsestack/database";

/**
 * Alert rule CRUD routes for a project.
 * All routes are scoped under /v1/projects/:projectId/alerts
 * and require:
 *   - JWT authentication (fastify.authenticate)
 *   - Project-level access authorization (fastify.authorizeProjectAccess)
 */
const alertRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // JWT auth on all routes in this plugin
  fastify.addHook("onRequest", fastify.authenticate);

  // -------------------------------------------------------------------------
  // GET /v1/projects/:projectId/alerts — list all alert rules for a project
  // -------------------------------------------------------------------------
  fastify.get(
    "/:projectId/alerts",
    {
      schema: {
        params: z.object({ projectId: z.string().min(1) }),
        response: {
          200: z.array(AlertRuleResponseSchema),
        },
      },
      preHandler: [fastify.authorizeProjectAccess],
    },
    async (request) => {
      const { projectId } = request.params;

      const rules = await fastify.db
        .select()
        .from(alertRules)
        .where(eq(alertRules.projectId, projectId))
        .orderBy(alertRules.createdAt);

      return rules.map(mapAlertRule);
    }
  );

  // -------------------------------------------------------------------------
  // POST /v1/projects/:projectId/alerts — create an alert rule
  // -------------------------------------------------------------------------
  fastify.post(
    "/:projectId/alerts",
    {
      schema: {
        params: z.object({ projectId: z.string().min(1) }),
        body: CreateAlertRuleSchema,
        response: {
          201: AlertRuleResponseSchema,
        },
      },
      preHandler: [fastify.authorizeProjectAccess],
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const body = request.body;

      const [newRule] = await fastify.db
        .insert(alertRules)
        .values({
          projectId,
          name: body.name,
          description: body.description ?? null,
          metric: body.metric,
          threshold: body.threshold,
          condition: body.condition,
          windowMinutes: body.windowMinutes ?? 5,
          cooldownMinutes: body.cooldownMinutes ?? 15,
          enabled: body.enabled ?? true,
        })
        .returning();

      reply.status(201);
      return mapAlertRule(newRule);
    }
  );

  // -------------------------------------------------------------------------
  // GET /v1/projects/:projectId/alerts/:ruleId — get a single alert rule
  // -------------------------------------------------------------------------
  fastify.get(
    "/:projectId/alerts/:ruleId",
    {
      schema: {
        params: z.object({
          projectId: z.string().min(1),
          ruleId: z.string().min(1),
        }),
        response: {
          200: AlertRuleResponseSchema,
        },
      },
      preHandler: [fastify.authorizeProjectAccess],
    },
    async (request) => {
      const { projectId, ruleId } = request.params;

      const [rule] = await fastify.db
        .select()
        .from(alertRules)
        .where(and(eq(alertRules.id, ruleId), eq(alertRules.projectId, projectId)))
        .limit(1);

      if (!rule) {
        throw fastify.httpErrors.notFound("Alert rule not found");
      }

      return mapAlertRule(rule);
    }
  );

  // -------------------------------------------------------------------------
  // PATCH /v1/projects/:projectId/alerts/:ruleId — update an alert rule
  // -------------------------------------------------------------------------
  fastify.patch(
    "/:projectId/alerts/:ruleId",
    {
      schema: {
        params: z.object({
          projectId: z.string().min(1),
          ruleId: z.string().min(1),
        }),
        body: UpdateAlertRuleSchema,
        response: {
          200: AlertRuleResponseSchema,
        },
      },
      preHandler: [fastify.authorizeProjectAccess],
    },
    async (request) => {
      const { projectId, ruleId } = request.params;
      const updates = request.body;

      const [existing] = await fastify.db
        .select()
        .from(alertRules)
        .where(and(eq(alertRules.id, ruleId), eq(alertRules.projectId, projectId)))
        .limit(1);

      if (!existing) {
        throw fastify.httpErrors.notFound("Alert rule not found");
      }

      const [updated] = await fastify.db
        .update(alertRules)
        .set({
          ...updates,
          description: updates.description ?? existing.description,
          updatedAt: new Date(),
        })
        .where(eq(alertRules.id, ruleId))
        .returning();

      return mapAlertRule(updated);
    }
  );

  // -------------------------------------------------------------------------
  // DELETE /v1/projects/:projectId/alerts/:ruleId — delete an alert rule
  // -------------------------------------------------------------------------
  fastify.delete(
    "/:projectId/alerts/:ruleId",
    {
      schema: {
        params: z.object({
          projectId: z.string().min(1),
          ruleId: z.string().min(1),
        }),
        response: {
          200: z.object({ success: z.boolean(), message: z.string() }),
        },
      },
      preHandler: [fastify.authorizeProjectAccess],
    },
    async (request) => {
      const { projectId, ruleId } = request.params;

      const [existing] = await fastify.db
        .select()
        .from(alertRules)
        .where(and(eq(alertRules.id, ruleId), eq(alertRules.projectId, projectId)))
        .limit(1);

      if (!existing) {
        throw fastify.httpErrors.notFound("Alert rule not found");
      }

      await fastify.db.delete(alertRules).where(eq(alertRules.id, ruleId));

      return { success: true, message: "Alert rule deleted" };
    }
  );
};

// ---------------------------------------------------------------------------
// Mapper: DB row → API response shape
// ---------------------------------------------------------------------------

function mapAlertRule(rule: typeof alertRules.$inferSelect) {
  return {
    id: rule.id,
    projectId: rule.projectId,
    name: rule.name,
    description: rule.description,
    metric: rule.metric as "error_rate" | "p95_latency_ms" | "request_volume",
    threshold: rule.threshold,
    condition: rule.condition as "gt" | "lt" | "gte" | "lte",
    windowMinutes: rule.windowMinutes,
    cooldownMinutes: rule.cooldownMinutes,
    enabled: rule.enabled,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

export default alertRoutes;
