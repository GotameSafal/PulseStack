"use client";

import React from "react";
import { AlertCircle, BarChart2, Loader2 } from "lucide-react";

/** Skeleton card used during loading state */
function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-secondary/60 ${className}`}
      aria-hidden="true"
    />
  );
}

export function DashboardLoadingState() {
  return (
    <div
      role="status"
      aria-label="Loading analytics data"
      className="space-y-6"
    >
      {/* KPI row skeleton */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-28" />
        ))}
      </div>
      {/* Charts skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonBlock className="h-60" />
        <SkeletonBlock className="h-60" />
      </div>
      {/* Status breakdown skeleton */}
      <SkeletonBlock className="h-20" />
    </div>
  );
}

export function DashboardEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-8 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
        <BarChart2 className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold text-foreground">No telemetry received yet</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Send events to your project using the PulseStack ingestion API and they
        will appear here once processed.
      </p>
      <p className="mt-4 font-mono text-xs text-muted-foreground/60">
        POST /v1/ingest · Bearer ps_live_…
      </p>
    </div>
  );
}

interface DashboardErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function DashboardErrorState({ message, onRetry }: DashboardErrorStateProps) {
  const displayMessage =
    message && !message.toLowerCase().includes("sql") && !message.toLowerCase().includes("clickhouse")
      ? message
      : "Unable to load analytics. Please try again.";

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-8 py-16 text-center"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-7 w-7 text-destructive" aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold text-foreground">Failed to load analytics</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{displayMessage}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function InlineLoadingSpinner() {
  return (
    <span role="status" aria-label="Refreshing">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
    </span>
  );
}
