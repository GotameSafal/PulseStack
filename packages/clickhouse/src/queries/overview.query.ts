import type { ClickHouseClient } from "@clickhouse/client";
import type { AnalyticsOverviewResponse } from "@pulsestack/shared";

export interface OverviewQueryParams {
  projectId: string;
  from: string | Date;
  to: string | Date;
  database?: string;
}

export function formatClickHouseDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().replace("T", " ").replace("Z", "");
}

/**
 * Builds the parameterized SQL and parameter map for Overview analytics.
 */
export function buildOverviewQuery(params: OverviewQueryParams): {
  query: string;
  query_params: Record<string, unknown>;
} {
  const db = params.database || "pulsestack";
  const fromStr = formatClickHouseDate(params.from);
  const toStr = formatClickHouseDate(params.to);

  const query = `
    SELECT
      count() AS total_requests,
      countIf(status_code >= 400) AS error_requests,
      round(if(count() = 0, 0, countIf(status_code >= 400) / count() * 100), 2) AS error_rate,
      round(quantile(0.50)(duration_ms), 2) AS p50_latency,
      round(quantile(0.90)(duration_ms), 2) AS p90_latency,
      round(quantile(0.95)(duration_ms), 2) AS p95_latency,
      round(quantile(0.99)(duration_ms), 2) AS p99_latency,
      countIf(status_code >= 200 AND status_code < 300) AS status_2xx,
      countIf(status_code >= 300 AND status_code < 400) AS status_3xx,
      countIf(status_code >= 400 AND status_code < 500) AS status_4xx,
      countIf(status_code >= 500) AS status_5xx
    FROM ${db}.http_requests
    WHERE project_id = {projectId: String}
      AND timestamp >= {from: DateTime64(3, 'UTC')}
      AND timestamp <= {to: DateTime64(3, 'UTC')}
  `;

  return {
    query,
    query_params: {
      projectId: params.projectId,
      from: fromStr,
      to: toStr,
    },
  };
}

/**
 * Executes the Overview query against ClickHouse and maps to AnalyticsOverviewResponse contract.
 */
export async function queryOverviewMetrics(
  client: ClickHouseClient,
  params: OverviewQueryParams
): Promise<AnalyticsOverviewResponse> {
  const fromDate = typeof params.from === "string" ? new Date(params.from) : params.from;
  const toDate = typeof params.to === "string" ? new Date(params.to) : params.to;
  const durationSeconds = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 1000));

  const { query, query_params } = buildOverviewQuery(params);

  const result = await client.query({
    query,
    query_params,
    format: "JSONEachRow",
  });

  const rows = (await result.json()) as any[];
  const raw = rows[0] || {};

  const totalRequests = Number(raw.total_requests || 0);
  const errorRequests = Number(raw.error_requests || 0);
  const throughputPerSecond = Number((totalRequests / durationSeconds).toFixed(2));

  return {
    projectId: params.projectId,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    totalRequests,
    errorRequests,
    errorRate: Number(raw.error_rate || 0),
    throughputPerSecond,
    p50LatencyMs: Number(raw.p50_latency || 0),
    p90LatencyMs: Number(raw.p90_latency || 0),
    p95LatencyMs: Number(raw.p95_latency || 0),
    p99LatencyMs: Number(raw.p99_latency || 0),
    statusBreakdown: {
      status2xx: Number(raw.status_2xx || 0),
      status3xx: Number(raw.status_3xx || 0),
      status4xx: Number(raw.status_4xx || 0),
      status5xx: Number(raw.status_5xx || 0),
    },
  };
}
