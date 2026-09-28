import axiosInstance from "@/api/setup/axiosInstance";
import type { IncidentResponse, UpdateIncident } from "@pulsestack/shared";

export interface FetchIncidentsParams {
  /** undefined = all statuses */
  status?: "open" | "resolved";
  limit?: number;
}

export function fetchIncidents(
  projectId: string,
  params: FetchIncidentsParams = {}
): Promise<IncidentResponse[]> {
  return axiosInstance
    .get<IncidentResponse[]>(`/projects/${projectId}/incidents`, { params })
    .then((r) => r.data);
}

export function updateIncident(
  projectId: string,
  incidentId: string,
  body: UpdateIncident
): Promise<IncidentResponse> {
  return axiosInstance
    .patch<IncidentResponse>(
      `/projects/${projectId}/incidents/${incidentId}`,
      body
    )
    .then((r) => r.data);
}
