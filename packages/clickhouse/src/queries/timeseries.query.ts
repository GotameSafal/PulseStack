import type { ClickHouseClient } from "@clickhouse/client";
import type { AnalyticsTimeSeriesResponse, TimeSeriesBucket } from "@pulsestack/shared";
import { formatClickHouseDate } from "./overview.query.js";

export interface TimeSeriesQueryParams {
  projectId: string;
  from: string | Date;
  to: string | Date;
  intervalMinutes?: number;
  database?: string;
}

export function buildTimeSeriesQuery(params: TimeSeriesQueryParams): {
  query: string;
  query_params: Record<string, unknown>;
} {
  const db = params.database || "pulsestack";
  const intervalMinutes = params.intervalMinutes && params.intervalMinutes > 0 ? params.intervalMinutes : 5;
  const fromStr = formatClickHouseDate(params.from);
  const toStr = formatClickHouseDate(params.to);

  const query = `
    SELECT
      toStartOfInterval(timestamp, INTERVAL {intervalMinutes: UInt32} MINUTE) AS bucket_time,
      count() AS request_count,
      countIf(status_code >= 400) AS error_count,
      round(if(count() = 0, 0, countIf(status_code >= 400) / count() * 100), 2) AS error_rate,
      round(quantile(0.50)(duration_ms), 2) AS p50,
      round(quantile(0.90)(duration_ms), 2) AS p90,
      round(quantile(0.95)(duration_ms), 2) AS p95,
      round(quantile(0.99)(duration_ms), 2) AS p99
    FROM ${db}.http_requests
    WHERE project_id = {projectId: String}
      AND timestamp >= {from: DateTime64(3, 'UTC')}
      AND timestamp <= {to: DateTime64(3, 'UTC')}
    GROUP BY bucket_time
    ORDER BY bucket_time ASC
  `;

  return {
    query,
    query_params: {
      projectId: params.projectId,
      intervalMinutes,
      from: fromStr,
      to: toStr,
    },
  };
}

export async function queryTimeSeriesMetrics(
  client: ClickHouseClient,
  params: TimeSeriesQueryParams
): Promise<AnalyticsTimeSeriesResponse> {
  const fromDate = typeof params.from === "string" ? new Date(params.from) : params.from;
  const toDate = typeof params.to === "string" ? new Date(params.to) : params.to;
  const intervalMinutes = params.intervalMinutes && params.intervalMinutes > 0 ? params.intervalMinutes : 5;

  const { query, query_params } = buildTimeSeriesQuery(params);

  const result = await client.query({
    query,
    query_params,
    format: "JSONEachRow",
  });

  const rows = (await result.json()) as any[];

  const buckets: TimeSeriesBucket[] = rows.map((r) => {
    // ClickHouse returns 'YYYY-MM-DD HH:mm:ss'
    const rawBucket = String(r.bucket_time || "");
    const isoBucket = rawBucket.includes("T")
      ? rawBucket
      : `${rawBucket.replace(" ", "T")}.000Z`;

    return {
      bucket: isoBucket,
      requestCount: Number(r.request_count || 0),
      errorCount: Number(r.error_count || 0),
      errorRate: Number(r.error_rate || 0),
      p50LatencyMs: Number(r.p50 || 0),
      p90LatencyMs: Number(r.p90 || 0),
      p95LatencyMs: Number(r.p95 || 0),
      p99LatencyMs: Number(r.p99 || 0),
    };
  });

  return {
    projectId: params.projectId,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    intervalMinutes,
    buckets,
  };
}
