import { useQuery } from "@tanstack/react-query";
import { fetchRequests, RequestsParams } from "@/api/analytics";

export function useProjectRequests(
  projectId: string,
  params: RequestsParams,
  refetchInterval: number = 0
) {
  return useQuery({
    queryKey: ["analytics", "requests", projectId, params],
    queryFn: () => fetchRequests(projectId, params),
    enabled: Boolean(projectId),
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
  });
}
