import { getAuthToken } from "@/lib/authStorage";
import type {
  AnalyticsOverviewResponse,
  AnalyticsTimeSeriesResponse,
  TimeRangePreset,
} from "@pulsestack/shared";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Builds query string from a plain params object, omitting undefined values. */
function buildQueryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

/** Authenticated fetch wrapper for the Fastify analytics API. */
async function analyticsGet<T>(path: string): Promise<T> {
  const token = await getAuthToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = (body as { message?: string }).message ?? `HTTP ${res.status}`;
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export interface OverviewParams {
  preset?: TimeRangePreset;
  from?: string;
  to?: string;
}

export interface TimeSeriesParams {
  preset?: TimeRangePreset;
  from?: string;
  to?: string;
  intervalMinutes?: number;
}

export function fetchOverview(
  projectId: string,
  params: OverviewParams
): Promise<AnalyticsOverviewResponse> {
  const qs = buildQueryString(params as Record<string, string | undefined>);
  return analyticsGet<AnalyticsOverviewResponse>(
    `/v1/projects/${projectId}/analytics/overview${qs}`
  );
}

export function fetchTimeSeries(
  projectId: string,
  params: TimeSeriesParams
): Promise<AnalyticsTimeSeriesResponse> {
  const qs = buildQueryString(params as Record<string, string | number | undefined>);
  return analyticsGet<AnalyticsTimeSeriesResponse>(
    `/v1/projects/${projectId}/analytics/timeseries${qs}`
  );
}

export interface RequestsParams {
  preset?: TimeRangePreset;
  from?: string;
  to?: string;
  method?: string;
  statusCode?: number;
  statusClass?: "2xx" | "3xx" | "4xx" | "5xx";
  pathPrefix?: string;
  minDurationMs?: number;
  limit?: number;
  offset?: number;
}

export function fetchRequests(
  projectId: string,
  params: RequestsParams
): Promise<import("@pulsestack/shared").RequestExplorerResponse> {
  const qs = buildQueryString(params as Record<string, string | number | undefined>);
  return analyticsGet<import("@pulsestack/shared").RequestExplorerResponse>(
    `/v1/projects/${projectId}/analytics/requests${qs}`
  );
}

export interface ErrorsParams {
  preset?: TimeRangePreset;
  from?: string;
  to?: string;
  handled?: boolean;
  limit?: number;
}

export function fetchErrors(
  projectId: string,
  params: ErrorsParams
): Promise<import("@pulsestack/shared").ErrorExplorerResponse> {
  const qs = buildQueryString({
    ...params,
    handled: params.handled !== undefined ? String(params.handled) : undefined,
  } as Record<string, string | number | undefined>);
  return analyticsGet<import("@pulsestack/shared").ErrorExplorerResponse>(
    `/v1/projects/${projectId}/analytics/errors${qs}`
  );
}

