"use client";

import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { TimeRangeSelector } from "./TimeRangeSelector";
import { AutoRefreshSelector } from "./AutoRefreshSelector";
import type { TimeRangePreset } from "@pulsestack/shared";

interface DashboardHeaderProps {
  projectId: string;
  /** Optional display name for the project */
  projectName?: string;
  preset: TimeRangePreset;
  onPresetChange: (preset: TimeRangePreset) => void;
  refreshIntervalMs: number;
  onRefreshIntervalChange: (ms: number) => void;
  isRefetching?: boolean;
}

export function DashboardHeader({
  projectId,
  projectName,
  preset,
  onPresetChange,
  refreshIntervalMs,
  onRefreshIntervalChange,
  isRefetching = false,
}: DashboardHeaderProps) {
  return (
    <PageHeader
      title="Project Overview"
      isLoading={isRefetching}
      breadcrumbs={[
        { label: "Projects", href: "/dashboard" },
        { label: projectName ?? projectId },
        { label: "Overview" },
      ]}
      actions={
        <>
          <AutoRefreshSelector
            value={refreshIntervalMs}
            onChange={onRefreshIntervalChange}
          />
          <TimeRangeSelector value={preset} onChange={onPresetChange} />
        </>
      }
    />
  );
}

