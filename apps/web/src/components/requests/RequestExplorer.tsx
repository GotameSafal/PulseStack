"use client";

import React, { useState } from "react";
import { ListFilter } from "lucide-react";
import { useProjectRequests } from "@/features/analytics/hooks/useProjectRequests";
import { useAutoRefreshInterval } from "@/features/analytics/hooks/useAutoRefreshInterval";
import { DEFAULT_TIME_RANGE } from "@/features/analytics/constants";
import { RequestFilters } from "./RequestFilters";
import { RequestTable } from "./RequestTable";
import { RequestDetailDrawer } from "./RequestDetailDrawer";
import {
  DashboardLoadingState,
  DashboardErrorState,
} from "@/components/analytics/DashboardStates";
import { PageHeader } from "@/components/ui/PageHeader";
import type { TimeRangePreset, RequestExplorerItem } from "@pulsestack/shared";

interface RequestExplorerProps {
  projectId: string;
}

const PAGE_SIZE = 50;

export function RequestExplorer({ projectId }: RequestExplorerProps) {
  const [preset, setPreset] = useState<TimeRangePreset>(DEFAULT_TIME_RANGE);
  const [method, setMethod] = useState<string>("ALL");
  const [statusClass, setStatusClass] = useState<string>("ALL");
  const [pathSearch, setPathSearch] = useState<string>("");
  const [offset, setOffset] = useState<number>(0);
  const [refreshIntervalMs, setRefreshIntervalMs] = useAutoRefreshInterval();
  const [selectedRequest, setSelectedRequest] = useState<RequestExplorerItem | null>(null);

  const queryParams = {
    preset,
    method: method !== "ALL" ? method : undefined,
    statusClass:
      statusClass !== "ALL"
        ? (statusClass as "2xx" | "3xx" | "4xx" | "5xx")
        : undefined,
    pathPrefix: pathSearch.trim().length > 0 ? pathSearch.trim() : undefined,
    limit: PAGE_SIZE,
    offset,
  };

  const { data, isLoading, isError, isFetching, error, refetch } = useProjectRequests(
    projectId,
    queryParams,
    refreshIntervalMs
  );

  function handleResetFilters() {
    setMethod("ALL");
    setStatusClass("ALL");
    setPathSearch("");
    setOffset(0);
  }

  function handleMethodChange(newMethod: string) {
    setMethod(newMethod);
    setOffset(0);
  }

  function handleStatusChange(newStatus: string) {
    setStatusClass(newStatus);
    setOffset(0);
  }

  function handlePathChange(newPath: string) {
    setPathSearch(newPath);
    setOffset(0);
  }

  const isRefetching = isFetching && !isLoading;
  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const isEmpty = !isLoading && !isError && items.length === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Request Explorer"
        isLoading={isRefetching}
        breadcrumbs={[
          { label: "Projects", href: "/dashboard" },
          { label: projectId },
          { label: "Requests" },
        ]}
      />

      {/* Filter Toolbar */}
      <RequestFilters
        preset={preset}
        onPresetChange={(p) => {
          setPreset(p);
          setOffset(0);
        }}
        method={method}
        onMethodChange={handleMethodChange}
        statusClass={statusClass}
        onStatusClassChange={handleStatusChange}
        pathSearch={pathSearch}
        onPathSearchChange={handlePathChange}
        refreshIntervalMs={refreshIntervalMs}
        onRefreshIntervalChange={setRefreshIntervalMs}
        onReset={handleResetFilters}
      />

      {/* Main Content States */}
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
            <ListFilter className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-foreground">No requests found</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            No HTTP telemetry matches the current filters or time range window. Try clearing active filters.
          </p>
          {(method !== "ALL" || statusClass !== "ALL" || pathSearch) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <RequestTable
          items={items}
          totalCount={totalCount}
          limit={PAGE_SIZE}
          offset={offset}
          onOffsetChange={setOffset}
          onSelectRequest={setSelectedRequest}
        />
      )}

      {/* Slide-over Detail Drawer */}
      <RequestDetailDrawer
        item={selectedRequest}
        onClose={() => setSelectedRequest(null)}
      />
    </div>
  );
}
