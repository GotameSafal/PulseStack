import { useQuery } from "@tanstack/react-query";
import { fetchErrors, ErrorsParams } from "@/api/analytics";

export function useProjectErrors(
  projectId: string,
  params: ErrorsParams,
  refetchInterval: number = 0
) {
  return useQuery({
    queryKey: ["analytics", "errors", projectId, params],
    queryFn: () => fetchErrors(projectId, params),
    enabled: Boolean(projectId),
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
  });
}
