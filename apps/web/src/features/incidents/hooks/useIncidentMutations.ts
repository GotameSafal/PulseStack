import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateIncident } from "@/api/incidents";
import type { UpdateIncident } from "@pulsestack/shared";

export function useUpdateIncident(projectId: string, incidentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateIncident) =>
      updateIncident(projectId, incidentId, body),
    onSuccess: () => {
      // Invalidate all status variants so every open tab refreshes
      queryClient.invalidateQueries({ queryKey: ["incidents", projectId] });
    },
  });
}
