import { useQuery } from "@tanstack/react-query";
import { fetchTimeSeries } from "@/api/analytics";
import { DEFAULT_TIME_RANGE } from "@/features/analytics/constants";
import type { TimeRangePreset } from "@pulsestack/shared";

export function useProjectTimeSeries(
  projectId: string,
  preset: TimeRangePreset = DEFAULT_TIME_RANGE,
  refetchInterval: number = 0
) {
  return useQuery({
    queryKey: ["analytics", "timeseries", projectId, preset],
    queryFn: () => fetchTimeSeries(projectId, { preset }),
    enabled: Boolean(projectId),
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
  });
}
