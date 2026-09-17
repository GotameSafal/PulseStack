import { z } from "zod";

/**
 * Standard relative time range presets supported by PulseStack
 */
export const TimeRangePresetEnum = z.enum(["15m", "1h", "6h", "24h", "7d"]);
export type TimeRangePreset = z.infer<typeof TimeRangePresetEnum>;

/**
 * Helper to compute from/to UTC Dates given a preset
 */
export function parseTimeRangePreset(preset: TimeRangePreset, now: Date = new Date()): { from: Date; to: Date; intervalMinutes: number } {
  const to = now;
  let millis = 0;
  let intervalMinutes = 1;

  switch (preset) {
    case "15m":
      millis = 15 * 60 * 1000;
      intervalMinutes = 1; // 1-minute buckets (15 data points)
      break;
    case "1h":
      millis = 60 * 60 * 1000;
      intervalMinutes = 2; // 2-minute buckets (30 data points)
      break;
    case "6h":
      millis = 6 * 60 * 60 * 1000;
      intervalMinutes = 10; // 10-minute buckets (36 data points)
      break;
    case "24h":
      millis = 24 * 60 * 60 * 1000;
      intervalMinutes = 30; // 30-minute buckets (48 data points)
      break;
    case "7d":
      millis = 7 * 24 * 60 * 60 * 1000;
      intervalMinutes = 180; // 3-hour buckets (56 data points)
      break;
  }

  const from = new Date(to.getTime() - millis);
  return { from, to, intervalMinutes };
}

/**
 * Common query parameters for analytical time-bounded requests
 */
export const AnalyticsQueryFilterSchema = z.object({
  from: z.string().datetime().or(z.date()).optional(),
  to: z.string().datetime().or(z.date()).optional(),
  preset: TimeRangePresetEnum.optional(),
});
export type AnalyticsQueryFilter = z.infer<typeof AnalyticsQueryFilterSchema>;

/**
 * 1. Overview Analytics Contract
 * Aggregates overall health, request volume, error rate, throughput, and latency percentiles
 */
export const AnalyticsOverviewResponseSchema = z.object({
  projectId: z.string(),
  from: z.string(),
  to: z.string(),
  totalRequests: z.number().int().nonnegative(),
  errorRequests: z.number().int().nonnegative(),
  errorRate: z.number().nonnegative(), // percentage (0.00 to 100.00)
  throughputPerSecond: z.number().nonnegative(), // average req/s over the window
  p50LatencyMs: z.number().nonnegative(),
  p90LatencyMs: z.number().nonnegative(),
  p95LatencyMs: z.number().nonnegative(),
  p99LatencyMs: z.number().nonnegative(),
  statusBreakdown: z.object({
    status2xx: z.number().int().nonnegative(),
    status3xx: z.number().int().nonnegative(),
    status4xx: z.number().int().nonnegative(),
    status5xx: z.number().int().nonnegative(),
  }),
});
export type AnalyticsOverviewResponse = z.infer<typeof AnalyticsOverviewResponseSchema>;

/**
 * 2. Time-Series Metrics Contract
 * Bucketed data points for throughput and latency percentiles over time
 */
export const TimeSeriesBucketSchema = z.object({
  bucket: z.string(), // ISO UTC timestamp representing start of interval
  requestCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  errorRate: z.number().nonnegative(),
  p50LatencyMs: z.number().nonnegative(),
  p90LatencyMs: z.number().nonnegative(),
  p95LatencyMs: z.number().nonnegative(),
  p99LatencyMs: z.number().nonnegative(),
});
export type TimeSeriesBucket = z.infer<typeof TimeSeriesBucketSchema>;

export const AnalyticsTimeSeriesResponseSchema = z.object({
  projectId: z.string(),
  from: z.string(),
  to: z.string(),
  intervalMinutes: z.number().int().positive(),
  buckets: z.array(TimeSeriesBucketSchema),
});
export type AnalyticsTimeSeriesResponse = z.infer<typeof AnalyticsTimeSeriesResponseSchema>;

/**
 * 3. Request Explorer Contract
 * Filterable, paginated raw HTTP request log inspection
 */
export const RequestExplorerQuerySchema = z.object({
  from: z.string().datetime().or(z.date()).optional(),
  to: z.string().datetime().or(z.date()).optional(),
  preset: TimeRangePresetEnum.optional(),
  method: z.string().optional(), // 'GET', 'POST', etc.
  statusCode: z.coerce.number().int().min(100).max(599).optional(),
  statusClass: z.enum(["2xx", "3xx", "4xx", "5xx"]).optional(),
  pathPrefix: z.string().optional(),
  minDurationMs: z.coerce.number().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type RequestExplorerQuery = z.infer<typeof RequestExplorerQuerySchema>;

export const RequestExplorerItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  timestamp: z.string(),
  method: z.string(),
  path: z.string(),
  statusCode: z.number().int(),
  durationMs: z.number().nonnegative(),
  clientIp: z.string().nullable(),
  userAgent: z.string().nullable(),
  headers: z.record(z.string()).default({}),
  queryParams: z.record(z.string()).default({}),
  requestBodySize: z.number().nullable(),
  responseBodySize: z.number().nullable(),
});
export type RequestExplorerItem = z.infer<typeof RequestExplorerItemSchema>;

export const RequestExplorerResponseSchema = z.object({
  items: z.array(RequestExplorerItemSchema),
  totalCount: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});
export type RequestExplorerResponse = z.infer<typeof RequestExplorerResponseSchema>;

/**
 * 4. Error Explorer & Grouping Contract
 * Aggregated exceptions grouped by fingerprint/name with stack trace context
 */
export const ErrorExplorerQuerySchema = z.object({
  from: z.string().datetime().or(z.date()).optional(),
  to: z.string().datetime().or(z.date()).optional(),
  preset: TimeRangePresetEnum.optional(),
  handled: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ErrorExplorerQuery = z.infer<typeof ErrorExplorerQuerySchema>;

export const ErrorGroupSummarySchema = z.object({
  groupKey: z.string(),
  name: z.string(),
  sampleMessage: z.string(),
  sampleStack: z.string().nullable(),
  occurrences: z.number().int().nonnegative(),
  firstSeen: z.string(),
  lastSeen: z.string(),
  handled: z.boolean(),
});
export type ErrorGroupSummary = z.infer<typeof ErrorGroupSummarySchema>;

export const ErrorExplorerResponseSchema = z.object({
  groups: z.array(ErrorGroupSummarySchema),
  totalErrors: z.number().int().nonnegative(),
  uniqueGroups: z.number().int().nonnegative(),
});
export type ErrorExplorerResponse = z.infer<typeof ErrorExplorerResponseSchema>;
