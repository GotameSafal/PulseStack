import { getAuthToken } from "@/lib/authStorage";
import type { IncidentResponse, UpdateIncident } from "@pulsestack/shared";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function incidentsFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
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

export interface FetchIncidentsParams {
  /** undefined = all statuses */
  status?: "open" | "resolved";
  limit?: number;
}

export function fetchIncidents(
  projectId: string,
  params: FetchIncidentsParams = {}
): Promise<IncidentResponse[]> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return incidentsFetch<IncidentResponse[]>(
    `/v1/projects/${projectId}/incidents${qs}`
  );
}

export function updateIncident(
  projectId: string,
  incidentId: string,
  body: UpdateIncident
): Promise<IncidentResponse> {
  return incidentsFetch<IncidentResponse>(
    `/v1/projects/${projectId}/incidents/${incidentId}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
}
