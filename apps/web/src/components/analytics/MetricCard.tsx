"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  /** Optional secondary detail line below the value */
  detail?: string;
  /** Semantic intent for the value — used for accessible color cues */
  intent?: "neutral" | "success" | "warning" | "danger";
  /** Whether data is currently stale/refreshing */
  isRefetching?: boolean;
}

const INTENT_CLASSES: Record<NonNullable<MetricCardProps["intent"]>, string> = {
  neutral: "text-foreground",
  success: "text-emerald-500",
  warning: "text-amber-500",
  danger: "text-rose-500",
};

const INTENT_BADGE: Record<NonNullable<MetricCardProps["intent"]>, string> = {
  neutral: "",
  success: "Healthy",
  warning: "Elevated",
  danger: "Critical",
};

export function MetricCard({
  label,
  value,
  unit,
  detail,
  intent = "neutral",
  isRefetching = false,
}: MetricCardProps) {
  const intentClass = INTENT_CLASSES[intent];
  const badgeLabel = INTENT_BADGE[intent];

  return (
    <article
      className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-secondary/20"
      aria-label={`${label}: ${value}${unit ? " " + unit : ""}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {intent !== "neutral" && badgeLabel && (
          <span
            aria-label={`Status: ${badgeLabel}`}
            className={cn(
              "rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              intent === "success" && "bg-emerald-500/10 text-emerald-500",
              intent === "warning" && "bg-amber-500/10 text-amber-500",
              intent === "danger" && "bg-rose-500/10 text-rose-500"
            )}
          >
            {badgeLabel}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1">
        <span
          className={cn("text-3xl font-bold leading-none tabular-nums", intentClass)}
          aria-live={isRefetching ? "polite" : "off"}
        >
          {value}
        </span>
        {unit && (
          <span className="text-sm text-muted-foreground">{unit}</span>
        )}
      </div>

      {detail && (
        <p className="mt-1.5 text-xs text-muted-foreground">{detail}</p>
      )}
    </article>
  );
}
