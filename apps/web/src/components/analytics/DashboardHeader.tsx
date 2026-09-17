"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TimeRangeSelector } from "./TimeRangeSelector";
import { AutoRefreshSelector } from "./AutoRefreshSelector";
import { InlineLoadingSpinner } from "./DashboardStates";
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
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Link
            href="/dashboard"
            className="hover:text-foreground transition-colors"
          >
            Projects
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="max-w-[200px] truncate font-mono text-muted-foreground">
            {projectName ?? projectId}
          </span>
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="text-foreground font-medium">Overview</span>
        </nav>

        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">Project Overview</h1>
          {isRefetching && <InlineLoadingSpinner />}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <AutoRefreshSelector
          value={refreshIntervalMs}
          onChange={onRefreshIntervalChange}
        />
        <TimeRangeSelector value={preset} onChange={onPresetChange} />
      </div>
    </header>
  );
}
