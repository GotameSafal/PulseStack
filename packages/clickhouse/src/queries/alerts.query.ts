import type { ClickHouseClient } from "@clickhouse/client";
import type { AlertMetric } from "@pulsestack/shared";
import { formatClickHouseDate } from "./overview.query.js";

export interface AlertMetricQueryParams {
  projectId: string;
  metric: AlertMetric;
  windowMinutes: number;
  database?: string;
  now?: Date | string;
}

export interface AlertMetricQueryResult {
  projectId: string;
  metric: AlertMetric;
  value: number;
  sampleCount: number;
  from: string;
  to: string;
}

/**
 * Executes a metric calculation against ClickHouse for a sliding lookback window [now - windowMinutes, now].
 * Supported metrics:
 * - error_rate: percentage (0 - 100) of HTTP requests with status_code >= 400
 * - p95_latency_ms: 95th percentile duration_ms of HTTP requests
 * - request_volume: total count of HTTP requests
 */
export async function evaluateAlertRuleMetric(
  client: ClickHouseClient,
  params: AlertMetricQueryParams
): Promise<AlertMetricQueryResult> {
  const db = params.database || "pulsestack";
  const toDate = params.now ? (typeof params.now === "string" ? new Date(params.now) : params.now) : new Date();
  const fromDate = new Date(toDate.getTime() - params.windowMinutes * 60 * 1000);

  const fromStr = formatClickHouseDate(fromDate);
  const toStr = formatClickHouseDate(toDate);

  let selectExpression = "0 AS val, count() AS total_count";
  if (params.metric === "error_rate") {
    selectExpression = "round(if(count() = 0, 0, countIf(status_code >= 400) / count() * 100), 2) AS val, count() AS total_count";
  } else if (params.metric === "p95_latency_ms") {
    selectExpression = "round(quantile(0.95)(duration_ms), 2) AS val, count() AS total_count";
  } else if (params.metric === "request_volume") {
    selectExpression = "count() AS val, count() AS total_count";
  }

  const query = `
    SELECT
      ${selectExpression}
    FROM ${db}.http_requests
    WHERE project_id = {projectId: String}
      AND timestamp >= {from: DateTime64(3, 'UTC')}
      AND timestamp <= {to: DateTime64(3, 'UTC')}
  `;

  const result = await client.query({
    query,
    query_params: {
      projectId: params.projectId,
      from: fromStr,
      to: toStr,
    },
    format: "JSONEachRow",
  });

  const rows = (await result.json()) as Array<{ val?: number | string; total_count?: number | string }>;
  const row = rows[0] || {};

  return {
    projectId: params.projectId,
    metric: params.metric,
    value: Number(row.val || 0),
    sampleCount: Number(row.total_count || 0),
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
  };
}
