import { useQuery } from "@tanstack/react-query";
import { fetchAlertRules } from "@/api/alerts";

export function useAlertRules(projectId: string) {
  return useQuery({
    queryKey: ["alerts", projectId],
    queryFn: () => fetchAlertRules(projectId),
    enabled: Boolean(projectId),
  });
}
