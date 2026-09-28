"use client";

import React, { useState } from "react";
import { useProjectOverview } from "@/features/analytics/hooks/useProjectOverview";
import { useProjectTimeSeries } from "@/features/analytics/hooks/useProjectTimeSeries";
import { useAutoRefreshInterval } from "@/features/analytics/hooks/useAutoRefreshInterval";
import { DEFAULT_TIME_RANGE } from "@/features/analytics/constants";
import { DashboardHeader } from "./DashboardHeader";
import { MetricGrid } from "./MetricGrid";
import { RequestVolumeChart } from "./RequestVolumeChart";
import { LatencyChart } from "./LatencyChart";
import { StatusBreakdown } from "./StatusBreakdown";
import {
  DashboardLoadingState,
  DashboardEmptyState,
  DashboardErrorState,
} from "./DashboardStates";
import type { TimeRangePreset } from "@pulsestack/shared";

interface OverviewDashboardProps {
  projectId: string;
}

export function OverviewDashboard({ projectId }: OverviewDashboardProps) {
  const [preset, setPreset] = useState<TimeRangePreset>(DEFAULT_TIME_RANGE);
  const [refreshIntervalMs, setRefreshIntervalMs] = useAutoRefreshInterval();

  const overviewQuery = useProjectOverview(projectId, preset, refreshIntervalMs);
  const timeSeriesQuery = useProjectTimeSeries(projectId, preset, refreshIntervalMs);

  const isLoading = overviewQuery.isLoading || timeSeriesQuery.isLoading;
  const isError = overviewQuery.isError || timeSeriesQuery.isError;
  const isRefetching =
    (overviewQuery.isFetching && !overviewQuery.isLoading) ||
    (timeSeriesQuery.isFetching && !timeSeriesQuery.isLoading);

  const errorMessage =
    overviewQuery.error instanceof Error
      ? overviewQuery.error.message
      : timeSeriesQuery.error instanceof Error
        ? timeSeriesQuery.error.message
        : undefined;

  const isEmpty =
    !isLoading &&
    !isError &&
    overviewQuery.data?.totalRequests === 0;

  function handleRetry() {
    overviewQuery.refetch();
    timeSeriesQuery.refetch();
  }

  return (
    <div>
      <DashboardHeader
        projectId={projectId}
        preset={preset}
        onPresetChange={setPreset}
        refreshIntervalMs={refreshIntervalMs}
        onRefreshIntervalChange={setRefreshIntervalMs}
        isRefetching={isRefetching}
      />

      {isLoading && <DashboardLoadingState />}

      {isError && !isLoading && (
        <DashboardErrorState message={errorMessage} onRetry={handleRetry} />
      )}

      {isEmpty && (
        <DashboardEmptyState />
      )}

      {!isLoading && !isError && !isEmpty && overviewQuery.data && timeSeriesQuery.data && (
        <div className="space-y-4">
          <MetricGrid data={overviewQuery.data} isRefetching={isRefetching} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RequestVolumeChart data={timeSeriesQuery.data} />
            <LatencyChart data={timeSeriesQuery.data} />
          </div>

          <StatusBreakdown
            data={overviewQuery.data.statusBreakdown}
            total={overviewQuery.data.totalRequests}
          />
        </div>
      )}
    </div>
  );
}
