import axiosInstance from "@/api/setup/axiosInstance";
import type {
  AlertRuleResponse,
  CreateAlertRule,
  UpdateAlertRule,
} from "@pulsestack/shared";

export function fetchAlertRules(projectId: string): Promise<AlertRuleResponse[]> {
  return axiosInstance
    .get<AlertRuleResponse[]>(`/projects/${projectId}/alerts`)
    .then((r) => r.data);
}

export function createAlertRule(
  projectId: string,
  body: CreateAlertRule
): Promise<AlertRuleResponse> {
  return axiosInstance
    .post<AlertRuleResponse>(`/projects/${projectId}/alerts`, body)
    .then((r) => r.data);
}

export function updateAlertRule(
  projectId: string,
  ruleId: string,
  body: UpdateAlertRule
): Promise<AlertRuleResponse> {
  return axiosInstance
    .patch<AlertRuleResponse>(`/projects/${projectId}/alerts/${ruleId}`, body)
    .then((r) => r.data);
}

export function deleteAlertRule(
  projectId: string,
  ruleId: string
): Promise<{ success: boolean; message: string }> {
  return axiosInstance
    .delete<{ success: boolean; message: string }>(
      `/projects/${projectId}/alerts/${ruleId}`
    )
    .then((r) => r.data);
}
