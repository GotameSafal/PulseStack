import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  AnalyticsQueryFilterSchema,
  AnalyticsOverviewResponseSchema,
  AnalyticsTimeSeriesResponseSchema,
  RequestExplorerQuerySchema,
  RequestExplorerResponseSchema,
  ErrorExplorerQuerySchema,
  ErrorExplorerResponseSchema,
  parseTimeRangePreset,
} from "@pulsestack/shared";
import {
  queryOverviewMetrics,
  queryTimeSeriesMetrics,
  queryRequestExplorerLogs,
  queryErrorGroups,
} from "@pulsestack/clickhouse";

/** Shared projectId param schema */
const ProjectIdParams = z.object({ projectId: z.string().uuid() });

/**
 * Resolves a time-range from either an explicit from/to pair or a preset.
 * Defaults to the last 1 hour if neither is provided.
 */
function resolveTimeRange(
  query: { from?: string | Date; to?: string | Date; preset?: string }
): { from: Date; to: Date } {
  if (query.preset) {
    const { from, to } = parseTimeRangePreset(query.preset as any);
    return { from, to };
  }
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - 60 * 60 * 1000);
  return { from, to };
}

const analyticsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All analytics routes require JWT authentication
  fastify.addHook("onRequest", fastify.authenticate);
  // All analytics routes require project membership (authorization)
  fastify.addHook("preHandler", fastify.authorizeProjectAccess as any);

  /**
   * GET /v1/projects/:projectId/analytics/overview
   * Returns aggregated health metrics: total requests, error rate, latency percentiles.
   */
  fastify.get(
    "/:projectId/analytics/overview",
    {
      schema: {
        params: ProjectIdParams,
        querystring: AnalyticsQueryFilterSchema,
        response: { 200: AnalyticsOverviewResponseSchema },
      },
    },
    async (request) => {
      const { from, to } = resolveTimeRange(request.query);
      return queryOverviewMetrics(fastify.clickhouse, {
        projectId: request.params.projectId,
        from,
        to,
      });
    }
  );

  /**
   * GET /v1/projects/:projectId/analytics/timeseries
   * Returns bucketed request volume + latency percentiles over time.
   */
  fastify.get(
    "/:projectId/analytics/timeseries",
    {
      schema: {
        params: ProjectIdParams,
        querystring: AnalyticsQueryFilterSchema.extend({
          intervalMinutes: z.coerce.number().int().min(1).max(1440).optional(),
        }),
        response: { 200: AnalyticsTimeSeriesResponseSchema },
      },
    },
    async (request) => {
      const { from, to } = resolveTimeRange(request.query);
      const intervalMinutes =
        request.query.intervalMinutes ??
        (request.query.preset
          ? parseTimeRangePreset(request.query.preset as any).intervalMinutes
          : 30);
      return queryTimeSeriesMetrics(fastify.clickhouse, {
        projectId: request.params.projectId,
        from,
        to,
        intervalMinutes,
      });
    }
  );

  /**
   * GET /v1/projects/:projectId/analytics/requests
   * Returns filtered, paginated raw HTTP request logs.
   */
  fastify.get(
    "/:projectId/analytics/requests",
    {
      schema: {
        params: ProjectIdParams,
        querystring: RequestExplorerQuerySchema,
        response: { 200: RequestExplorerResponseSchema },
      },
    },
    async (request) => {
      const { from, to } = resolveTimeRange(request.query);
      const { method, statusCode, statusClass, pathPrefix, minDurationMs, limit, offset } =
        request.query;
      return queryRequestExplorerLogs(fastify.clickhouse, {
        projectId: request.params.projectId,
        from,
        to,
        method,
        statusCode,
        statusClass,
        pathPrefix,
        minDurationMs,
        limit,
        offset,
      });
    }
  );

  /**
   * GET /v1/projects/:projectId/analytics/errors
   * Returns grouped error summaries with occurrence counts and stack traces.
   */
  fastify.get(
    "/:projectId/analytics/errors",
    {
      schema: {
        params: ProjectIdParams,
        querystring: ErrorExplorerQuerySchema,
        response: { 200: ErrorExplorerResponseSchema },
      },
    },
    async (request) => {
      const { from, to } = resolveTimeRange(request.query);
      const { handled, limit } = request.query;
      return queryErrorGroups(fastify.clickhouse, {
        projectId: request.params.projectId,
        from,
        to,
        handled,
        limit,
      });
    }
  );
};

export default analyticsRoutes;
