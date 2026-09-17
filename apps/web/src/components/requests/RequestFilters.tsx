"use client";

import React from "react";
import { Search, Filter, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TimeRangeSelector } from "@/components/analytics/TimeRangeSelector";
import { AutoRefreshSelector } from "@/components/analytics/AutoRefreshSelector";
import type { TimeRangePreset } from "@pulsestack/shared";

interface RequestFiltersProps {
  preset: TimeRangePreset;
  onPresetChange: (preset: TimeRangePreset) => void;
  method: string;
  onMethodChange: (method: string) => void;
  statusClass: string;
  onStatusClassChange: (statusClass: string) => void;
  pathSearch: string;
  onPathSearchChange: (search: string) => void;
  refreshIntervalMs: number;
  onRefreshIntervalChange: (ms: number) => void;
  onReset: () => void;
}

const METHODS = ["ALL", "GET", "POST", "PUT", "PATCH", "DELETE"];
const STATUS_CLASSES = [
  { label: "All Status", value: "ALL" },
  { label: "2xx Success", value: "2xx" },
  { label: "3xx Redirect", value: "3xx" },
  { label: "4xx Client Err", value: "4xx" },
  { label: "5xx Server Err", value: "5xx" },
];

export function RequestFilters({
  preset,
  onPresetChange,
  method,
  onMethodChange,
  statusClass,
  onStatusClassChange,
  pathSearch,
  onPathSearchChange,
  refreshIntervalMs,
  onRefreshIntervalChange,
  onReset,
}: RequestFiltersProps) {
  const isFiltered =
    method !== "ALL" ||
    statusClass !== "ALL" ||
    pathSearch.trim().length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-xs">
      {/* Top row: Path search + Preset + Auto-refresh */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-[240px]">
          <Input
            placeholder="Filter by path prefix (e.g. /v1/api)..."
            value={pathSearch}
            onChange={(e) => onPathSearchChange(e.target.value)}
            startContent={<Search className="h-4 w-4" aria-hidden="true" />}
            className="py-1 text-xs"
            aria-label="Filter requests by path prefix"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AutoRefreshSelector
            value={refreshIntervalMs}
            onChange={onRefreshIntervalChange}
          />
          <TimeRangeSelector value={preset} onChange={onPresetChange} />
        </div>
      </div>

      {/* Bottom row: Method buttons + Status Class selector + Reset */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-medium text-muted-foreground">Method:</span>
          {METHODS.map((m) => {
            const active = method === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onMethodChange(m)}
                aria-pressed={active}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {m}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <Select
              options={STATUS_CLASSES}
              selectedKey={statusClass}
              onSelectionChange={(key) => {
                if (key !== null && key !== undefined) {
                  onStatusClassChange(String(key));
                }
              }}
              className="w-auto min-w-[130px]"
              triggerClassName="py-1 text-xs bg-background"
              aria-label="Filter by HTTP status class"
            />
          </div>

          {isFiltered && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Reset filters"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
