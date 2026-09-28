import axiosInstance from "@/api/setup/axiosInstance";
import type {
  AnalyticsOverviewResponse,
  AnalyticsTimeSeriesResponse,
  TimeRangePreset,
} from "@pulsestack/shared";

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

export interface ErrorsParams {
  preset?: TimeRangePreset;
  from?: string;
  to?: string;
  handled?: boolean;
  limit?: number;
}

export function fetchOverview(
  projectId: string,
  params: OverviewParams
): Promise<AnalyticsOverviewResponse> {
  return axiosInstance
    .get<AnalyticsOverviewResponse>(
      `/projects/${projectId}/analytics/overview`,
      { params }
    )
    .then((r) => r.data);
}

export function fetchTimeSeries(
  projectId: string,
  params: TimeSeriesParams
): Promise<AnalyticsTimeSeriesResponse> {
  return axiosInstance
    .get<AnalyticsTimeSeriesResponse>(
      `/projects/${projectId}/analytics/timeseries`,
      { params }
    )
    .then((r) => r.data);
}

export function fetchRequests(
  projectId: string,
  params: RequestsParams
): Promise<import("@pulsestack/shared").RequestExplorerResponse> {
  return axiosInstance
    .get(`/projects/${projectId}/analytics/requests`, { params })
    .then((r) => r.data);
}

export function fetchErrors(
  projectId: string,
  params: ErrorsParams
): Promise<import("@pulsestack/shared").ErrorExplorerResponse> {
  return axiosInstance
    .get(`/projects/${projectId}/analytics/errors`, { params })
    .then((r) => r.data);
}
