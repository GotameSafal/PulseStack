"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { TimeRangePreset } from "@pulsestack/shared";
import { TIME_RANGE_PRESETS } from "@/features/analytics/constants";

interface TimeRangeSelectorProps {
  value: TimeRangePreset;
  onChange: (preset: TimeRangePreset) => void;
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Time range"
      className="flex items-center rounded-lg border border-border bg-secondary/40 p-0.5"
    >
      {TIME_RANGE_PRESETS.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
