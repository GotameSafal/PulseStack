import type { ClickHouseClient } from "@clickhouse/client";
import type { RequestExplorerResponse, RequestExplorerItem } from "@pulsestack/shared";
import { formatClickHouseDate } from "./overview.query.js";

export interface RequestExplorerQueryParams {
  projectId: string;
  from: string | Date;
  to: string | Date;
  method?: string;
  statusCode?: number;
  statusClass?: "2xx" | "3xx" | "4xx" | "5xx";
  pathPrefix?: string;
  minDurationMs?: number;
  limit?: number;
  offset?: number;
  database?: string;
}

export function buildRequestExplorerQuery(params: RequestExplorerQueryParams): {
  dataQuery: string;
  countQuery: string;
  query_params: Record<string, unknown>;
} {
  const db = params.database || "pulsestack";
  const limit = Math.min(200, Math.max(1, params.limit ?? 50));
  const offset = Math.max(0, params.offset ?? 0);
  const fromStr = formatClickHouseDate(params.from);
  const toStr = formatClickHouseDate(params.to);

  const query_params: Record<string, unknown> = {
    projectId: params.projectId,
    from: fromStr,
    to: toStr,
    limit,
    offset,
  };

  const conditions: string[] = [
    "project_id = {projectId: String}",
    "timestamp >= {from: DateTime64(3, 'UTC')}",
    "timestamp <= {to: DateTime64(3, 'UTC')}",
  ];

  if (params.method) {
    conditions.push("method = {method: String}");
    query_params.method = params.method.toUpperCase();
  }

  if (params.statusCode) {
    conditions.push("status_code = {statusCode: UInt16}");
    query_params.statusCode = params.statusCode;
  } else if (params.statusClass) {
    switch (params.statusClass) {
      case "2xx":
        conditions.push("status_code >= 200 AND status_code < 300");
        break;
      case "3xx":
        conditions.push("status_code >= 300 AND status_code < 400");
        break;
      case "4xx":
        conditions.push("status_code >= 400 AND status_code < 500");
        break;
      case "5xx":
        conditions.push("status_code >= 500");
        break;
    }
  }

  if (params.pathPrefix) {
    conditions.push("startsWith(path, {pathPrefix: String})");
    query_params.pathPrefix = params.pathPrefix;
  }

  if (params.minDurationMs && params.minDurationMs > 0) {
    conditions.push("duration_ms >= {minDurationMs: Float64}");
    query_params.minDurationMs = params.minDurationMs;
  }

  const whereClause = conditions.join(" AND ");

  const dataQuery = `
    SELECT
      id,
      project_id,
      timestamp,
      method,
      path,
      status_code,
      duration_ms,
      client_ip,
      user_agent,
      headers,
      query_params,
      request_body_size,
      response_body_size
    FROM ${db}.http_requests
    WHERE ${whereClause}
    ORDER BY (project_id, timestamp, id) DESC
    LIMIT {limit: UInt32} OFFSET {offset: UInt32}
  `;

  const countQuery = `
    SELECT count() AS total_count
    FROM ${db}.http_requests
    WHERE ${whereClause}
  `;

  return { dataQuery, countQuery, query_params };
}

export async function queryRequestExplorerLogs(
  client: ClickHouseClient,
  params: RequestExplorerQueryParams
): Promise<RequestExplorerResponse> {
  const { dataQuery, countQuery, query_params } = buildRequestExplorerQuery(params);

  // Execute data and count queries concurrently
  const [dataResult, countResult] = await Promise.all([
    client.query({ query: dataQuery, query_params, format: "JSONEachRow" }),
    client.query({ query: countQuery, query_params, format: "JSONEachRow" }),
  ]);

  const rows = (await dataResult.json()) as any[];
  const countRows = (await countResult.json()) as any[];
  const totalCount = Number(countRows[0]?.total_count || 0);

  const items: RequestExplorerItem[] = rows.map((r) => {
    const rawTimestamp = String(r.timestamp || "");
    const isoTimestamp = rawTimestamp.includes("T")
      ? rawTimestamp
      : `${rawTimestamp.replace(" ", "T")}.000Z`;

    return {
      id: String(r.id),
      projectId: String(r.project_id),
      timestamp: isoTimestamp,
      method: String(r.method),
      path: String(r.path),
      statusCode: Number(r.status_code),
      durationMs: Number(r.duration_ms),
      clientIp: r.client_ip ? String(r.client_ip) : null,
      userAgent: r.user_agent ? String(r.user_agent) : null,
      headers: typeof r.headers === "object" && r.headers !== null ? r.headers : {},
      queryParams: typeof r.query_params === "object" && r.query_params !== null ? r.query_params : {},
      requestBodySize: r.request_body_size !== null && r.request_body_size !== undefined ? Number(r.request_body_size) : null,
      responseBodySize: r.response_body_size !== null && r.response_body_size !== undefined ? Number(r.response_body_size) : null,
    };
  });

  return {
    items,
    totalCount,
    limit: Number(query_params.limit),
    offset: Number(query_params.offset),
  };
}
