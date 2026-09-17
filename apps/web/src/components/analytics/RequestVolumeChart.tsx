"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { AnalyticsTimeSeriesResponse } from "@pulsestack/shared";

interface RequestVolumeChartProps {
  data: AnalyticsTimeSeriesResponse;
}

interface TooltipPayload {
  value: number;
  name: string;
}

interface CustomTooltipProps {
  active?: boolean;
  label?: string;
  payload?: TooltipPayload[];
}

function formatBucketLabel(bucket: string, intervalMinutes: number): string {
  const date = new Date(bucket);
  if (intervalMinutes >= 1440) {
    // >= 1 day buckets → show date
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  if (intervalMinutes >= 60) {
    // hour buckets → show time HH:MM
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  // minute buckets → show HH:MM
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function ChartTooltip({ active, label, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-mono text-muted-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="font-medium text-foreground">
          {entry.value.toLocaleString()} requests
        </p>
      ))}
    </div>
  );
}

export function RequestVolumeChart({ data }: RequestVolumeChartProps) {
  const chartData = data.buckets.map((b) => ({
    bucket: formatBucketLabel(b.bucket, data.intervalMinutes),
    requests: b.requestCount,
    errors: b.errorCount,
  }));

  return (
    <section
      className="rounded-lg border border-border bg-card p-4"
      aria-label="Request volume over time"
    >
      <h2 className="mb-1 text-sm font-semibold text-foreground">Request Volume</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Requests per {data.intervalMinutes}m bucket
      </p>
      {chartData.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          No data for selected range
        </div>
      ) : (
        <div aria-hidden="true">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--ps-chart-volume)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--ps-chart-volume)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="bucket"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "hsl(var(--border))" }} />
              <Area
                type="monotone"
                dataKey="requests"
                stroke="var(--ps-chart-volume)"
                strokeWidth={1.5}
                fill="url(#volumeGradient)"
                dot={false}
                activeDot={{ r: 3, fill: "var(--ps-chart-volume)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {/* Accessible summary for screen readers */}
      <p className="sr-only">
        Total of {data.buckets.reduce((s, b) => s + b.requestCount, 0).toLocaleString()} requests
        across {data.buckets.length} time buckets.
      </p>
    </section>
  );
}
