import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
} from "@/api/alerts";
import type { CreateAlertRule, UpdateAlertRule } from "@pulsestack/shared";

export function useCreateAlertRule(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAlertRule) => createAlertRule(projectId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", projectId] });
    },
  });
}

export function useUpdateAlertRule(projectId: string, ruleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateAlertRule) =>
      updateAlertRule(projectId, ruleId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", projectId] });
    },
  });
}

export function useDeleteAlertRule(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => deleteAlertRule(projectId, ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", projectId] });
    },
  });
}
