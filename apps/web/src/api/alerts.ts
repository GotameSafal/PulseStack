import { getAuthToken } from "@/lib/authStorage";
import type {
  AlertRuleResponse,
  CreateAlertRule,
  UpdateAlertRule,
} from "@pulsestack/shared";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function alertsFetch<T>(
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

  // DELETE returns { success, message } — callers that don't need the body can ignore it
  return res.json() as Promise<T>;
}

export function fetchAlertRules(projectId: string): Promise<AlertRuleResponse[]> {
  return alertsFetch<AlertRuleResponse[]>(`/v1/projects/${projectId}/alerts`);
}

export function createAlertRule(
  projectId: string,
  body: CreateAlertRule
): Promise<AlertRuleResponse> {
  return alertsFetch<AlertRuleResponse>(`/v1/projects/${projectId}/alerts`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateAlertRule(
  projectId: string,
  ruleId: string,
  body: UpdateAlertRule
): Promise<AlertRuleResponse> {
  return alertsFetch<AlertRuleResponse>(
    `/v1/projects/${projectId}/alerts/${ruleId}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
}

export function deleteAlertRule(
  projectId: string,
  ruleId: string
): Promise<{ success: boolean; message: string }> {
  return alertsFetch<{ success: boolean; message: string }>(
    `/v1/projects/${projectId}/alerts/${ruleId}`,
    { method: "DELETE" }
  );
}
