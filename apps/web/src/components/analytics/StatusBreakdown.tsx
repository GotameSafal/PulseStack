"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { AnalyticsOverviewResponse } from "@pulsestack/shared";

interface StatusBreakdownProps {
  data: AnalyticsOverviewResponse["statusBreakdown"];
  total: number;
}

interface StatusSegment {
  label: string;
  count: number;
  colorClass: string;
  bgClass: string;
  textClass: string;
}

export function StatusBreakdown({ data, total }: StatusBreakdownProps) {
  const segments: StatusSegment[] = [
    {
      label: "2xx",
      count: data.status2xx,
      colorClass: "bg-emerald-500",
      bgClass: "bg-emerald-500/10",
      textClass: "text-emerald-500",
    },
    {
      label: "3xx",
      count: data.status3xx,
      colorClass: "bg-sky-500",
      bgClass: "bg-sky-500/10",
      textClass: "text-sky-400",
    },
    {
      label: "4xx",
      count: data.status4xx,
      colorClass: "bg-amber-500",
      bgClass: "bg-amber-500/10",
      textClass: "text-amber-500",
    },
    {
      label: "5xx",
      count: data.status5xx,
      colorClass: "bg-rose-500",
      bgClass: "bg-rose-500/10",
      textClass: "text-rose-500",
    },
  ];

  const hasData = total > 0;

  return (
    <section
      className="rounded-lg border border-border bg-card p-4"
      aria-label="Status code breakdown"
    >
      <h2 className="mb-3 text-sm font-semibold text-foreground">Status Breakdown</h2>

      {/* Stacked bar */}
      {hasData && (
        <div
          className="mb-3 flex h-2 w-full overflow-hidden rounded-full"
          role="img"
          aria-label={`Status breakdown: ${data.status2xx} success, ${data.status3xx} redirect, ${data.status4xx} client error, ${data.status5xx} server error`}
        >
          {segments.map((seg) => {
            const pct = total > 0 ? (seg.count / total) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div
                key={seg.label}
                className={cn("h-full transition-all", seg.colorClass)}
                style={{ width: `${pct}%` }}
              />
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {segments.map((seg) => {
          const pct = total > 0 ? ((seg.count / total) * 100).toFixed(1) : "0.0";
          return (
            <div key={seg.label} className="flex items-center gap-1.5">
              <span
                className={cn("inline-block h-2 w-2 rounded-full", seg.colorClass)}
                aria-hidden="true"
              />
              <span className={cn("font-mono text-xs font-semibold", seg.textClass)}>
                {seg.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {seg.count.toLocaleString()} ({pct}%)
              </span>
            </div>
          );
        })}
        {!hasData && (
          <p className="text-xs text-muted-foreground">No requests in selected range</p>
        )}
      </div>
    </section>
  );
}
