import type { ClickHouseClient } from "@clickhouse/client";
import type { ErrorExplorerResponse, ErrorGroupSummary } from "@pulsestack/shared";
import { formatClickHouseDate } from "./overview.query.js";

export interface ErrorExplorerQueryParams {
  projectId: string;
  from: string | Date;
  to: string | Date;
  handled?: boolean;
  limit?: number;
  database?: string;
}

export function buildErrorExplorerQuery(params: ErrorExplorerQueryParams): {
  groupsQuery: string;
  totalsQuery: string;
  query_params: Record<string, unknown>;
} {
  const db = params.database || "pulsestack";
  const limit = Math.min(100, Math.max(1, params.limit ?? 50));
  const fromStr = formatClickHouseDate(params.from);
  const toStr = formatClickHouseDate(params.to);

  const query_params: Record<string, unknown> = {
    projectId: params.projectId,
    from: fromStr,
    to: toStr,
    limit,
  };

  const conditions: string[] = [
    "project_id = {projectId: String}",
    "timestamp >= {from: DateTime64(3, 'UTC')}",
    "timestamp <= {to: DateTime64(3, 'UTC')}",
  ];

  if (typeof params.handled === "boolean") {
    conditions.push("handled = {handled: Bool}");
    query_params.handled = params.handled;
  }

  const whereClause = conditions.join(" AND ");

  const groupsQuery = `
    SELECT
      coalesce(nullIf(fingerprint, ''), name) AS group_key,
      name,
      any(message) AS sample_message,
      any(stack) AS sample_stack,
      count() AS occurrences,
      min(timestamp) AS first_seen,
      max(timestamp) AS last_seen,
      any(handled) AS handled
    FROM ${db}.errors
    WHERE ${whereClause}
    GROUP BY group_key, name
    ORDER BY occurrences DESC
    LIMIT {limit: UInt32}
  `;

  const totalsQuery = `
    SELECT
      count() AS total_errors,
      uniqExact(coalesce(nullIf(fingerprint, ''), name)) AS unique_groups
    FROM ${db}.errors
    WHERE ${whereClause}
  `;

  return { groupsQuery, totalsQuery, query_params };
}

export async function queryErrorGroups(
  client: ClickHouseClient,
  params: ErrorExplorerQueryParams
): Promise<ErrorExplorerResponse> {
  const { groupsQuery, totalsQuery, query_params } = buildErrorExplorerQuery(params);

  const [groupsResult, totalsResult] = await Promise.all([
    client.query({ query: groupsQuery, query_params, format: "JSONEachRow" }),
    client.query({ query: totalsQuery, query_params, format: "JSONEachRow" }),
  ]);

  const rows = (await groupsResult.json()) as any[];
  const totalsRows = (await totalsResult.json()) as any[];
  const totalErrors = Number(totalsRows[0]?.total_errors || 0);
  const uniqueGroups = Number(totalsRows[0]?.unique_groups || 0);

  const groups: ErrorGroupSummary[] = rows.map((r) => {
    const rawFirst = String(r.first_seen || "");
    const rawLast = String(r.last_seen || "");

    const isoFirst = rawFirst.includes("T") ? rawFirst : `${rawFirst.replace(" ", "T")}.000Z`;
    const isoLast = rawLast.includes("T") ? rawLast : `${rawLast.replace(" ", "T")}.000Z`;

    return {
      groupKey: String(r.group_key),
      name: String(r.name),
      sampleMessage: String(r.sample_message || ""),
      sampleStack: r.sample_stack ? String(r.sample_stack) : null,
      occurrences: Number(r.occurrences || 0),
      firstSeen: isoFirst,
      lastSeen: isoLast,
      handled: Boolean(r.handled),
    };
  });

  return {
    groups,
    totalErrors,
    uniqueGroups,
  };
}
