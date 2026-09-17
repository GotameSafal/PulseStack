import { useQuery } from "@tanstack/react-query";
import { fetchOverview } from "@/api/analytics";
import { DEFAULT_TIME_RANGE } from "@/features/analytics/constants";
import type { TimeRangePreset } from "@pulsestack/shared";

export function useProjectOverview(
  projectId: string,
  preset: TimeRangePreset = DEFAULT_TIME_RANGE,
  refetchInterval: number = 0
) {
  return useQuery({
    queryKey: ["analytics", "overview", projectId, preset],
    queryFn: () => fetchOverview(projectId, { preset }),
    enabled: Boolean(projectId),
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
  });
}
