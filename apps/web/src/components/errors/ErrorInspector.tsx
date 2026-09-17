"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronRight, ShieldAlert } from "lucide-react";
import { useProjectErrors } from "@/features/analytics/hooks/useProjectErrors";
import { DEFAULT_TIME_RANGE, DEFAULT_REFRESH_INTERVAL_MS } from "@/features/analytics/constants";
import { TimeRangeSelector } from "@/components/analytics/TimeRangeSelector";
import { AutoRefreshSelector } from "@/components/analytics/AutoRefreshSelector";
import { ErrorList } from "./ErrorList";
import { StackTraceViewer } from "./StackTraceViewer";
import {
  DashboardLoadingState,
  DashboardErrorState,
  InlineLoadingSpinner,
} from "@/components/analytics/DashboardStates";
import type { TimeRangePreset } from "@pulsestack/shared";

interface ErrorInspectorProps {
  projectId: string;
}

export function ErrorInspector({ projectId }: ErrorInspectorProps) {
  const [preset, setPreset] = useState<TimeRangePreset>(DEFAULT_TIME_RANGE);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState<number>(DEFAULT_REFRESH_INTERVAL_MS);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);

  const { data, isLoading, isError, isFetching, error, refetch } = useProjectErrors(
    projectId,
    { preset },
    refreshIntervalMs
  );

  const groups = data?.groups ?? [];
  const totalErrors = data?.totalErrors ?? 0;
  const uniqueGroups = data?.uniqueGroups ?? 0;

  // Derive the active group: either the user's explicit selection, or the first group
  const activeGroupKey = selectedGroupKey ?? groups[0]?.groupKey ?? null;
  const selectedGroup = groups.find((g) => g.groupKey === activeGroupKey) ?? null;


  const isRefetching = isFetching && !isLoading;
  const isEmpty = !isLoading && !isError && groups.length === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Projects
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="max-w-[200px] truncate font-mono text-muted-foreground">{projectId}</span>
            <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="text-foreground font-medium">Errors</span>
          </nav>

          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">Error Inspector</h1>
            {isRefetching && <InlineLoadingSpinner />}
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <AutoRefreshSelector
            value={refreshIntervalMs}
            onChange={setRefreshIntervalMs}
          />
          <TimeRangeSelector value={preset} onChange={setPreset} />
        </div>
      </header>

      {/* KPI Stats Pill Row */}
      {!isLoading && !isError && !isEmpty && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div>
            Total Errors: <span className="font-semibold text-foreground">{totalErrors.toLocaleString()}</span>
          </div>
          <div>•</div>
          <div>
            Unique Issues: <span className="font-semibold text-foreground">{uniqueGroups.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* States */}
      {isLoading && <DashboardLoadingState />}

      {isError && !isLoading && (
        <DashboardErrorState
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => refetch()}
        />
      )}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-8 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
            <ShieldAlert className="h-7 w-7 text-emerald-500" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-foreground">No errors recorded</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            No exceptions or error logs have been captured in the selected time range window.
          </p>
        </div>
      )}

      {/* Master-Detail Split Grid */}
      {!isLoading && !isError && groups.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
          <div className="lg:col-span-5">
            <ErrorList
              groups={groups}
              selectedGroup={selectedGroup}
              onSelectGroup={(g) => setSelectedGroupKey(g.groupKey)}
            />
          </div>

          <div className="lg:col-span-7">
            {selectedGroup ? (
              <StackTraceViewer error={selectedGroup} />
            ) : (
              <div className="rounded-lg border border-border bg-card p-8 text-center text-xs text-muted-foreground">
                Select an error group on the left to inspect its stack trace and context.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
