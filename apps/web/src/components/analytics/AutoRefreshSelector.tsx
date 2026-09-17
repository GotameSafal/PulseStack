"use client";

import React from "react";
import { Select } from "@/components/ui/Select";
import { AUTO_REFRESH_OPTIONS } from "@/features/analytics/constants";

interface AutoRefreshSelectorProps {
  value: number;
  onChange: (intervalMs: number) => void;
}

const SELECT_OPTIONS = AUTO_REFRESH_OPTIONS.map((opt) => ({
  label: opt.label,
  value: String(opt.intervalMs),
}));

export function AutoRefreshSelector({ value, onChange }: AutoRefreshSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground whitespace-nowrap" id="auto-refresh-label">
        Refresh
      </span>
      <Select
        aria-labelledby="auto-refresh-label"
        options={SELECT_OPTIONS}
        selectedKey={String(value)}
        onSelectionChange={(key) => {
          if (key !== null && key !== undefined) {
            onChange(Number(key));
          }
        }}
        className="w-auto min-w-[95px]"
        triggerClassName="bg-secondary/40 py-1 text-xs"
      />
    </div>
  );
}

