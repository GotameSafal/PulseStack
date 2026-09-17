import { useQuery } from "@tanstack/react-query";
import { fetchIncidents } from "@/api/incidents";

export function useIncidents(
  projectId: string,
  status?: "open" | "resolved"
) {
  return useQuery({
    queryKey: ["incidents", projectId, status ?? "all"],
    queryFn: () => fetchIncidents(projectId, { status, limit: 100 }),
    enabled: Boolean(projectId),
    refetchInterval: 30_000,
  });
}
