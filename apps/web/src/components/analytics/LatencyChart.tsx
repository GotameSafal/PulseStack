"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { AnalyticsTimeSeriesResponse } from "@pulsestack/shared";

// Design system chart palette
const LATENCY_LINES = [
  { key: "p50", label: "p50", color: "#60a5fa" },
  { key: "p90", label: "p90", color: "#818cf8" },
  { key: "p95", label: "p95", color: "#f59e0b" },
  { key: "p99", label: "p99", color: "#f43f5e" },
] as const;

interface LatencyChartData {
  bucket: string;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

interface TooltipPayload {
  dataKey: string;
  value: number;
  color: string;
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
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function ChartTooltip({ active, label, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-mono text-muted-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
            aria-hidden="true"
          />
          <span className="w-8 text-muted-foreground">{entry.name}</span>
          <span className="font-mono font-semibold" style={{ color: entry.color }}>
            {entry.value.toFixed(1)} ms
          </span>
        </div>
      ))}
    </div>
  );
}

interface LatencyChartProps {
  data: AnalyticsTimeSeriesResponse;
}

export function LatencyChart({ data }: LatencyChartProps) {
  const chartData: LatencyChartData[] = data.buckets.map((b) => ({
    bucket: formatBucketLabel(b.bucket, data.intervalMinutes),
    p50: b.p50LatencyMs,
    p90: b.p90LatencyMs,
    p95: b.p95LatencyMs,
    p99: b.p99LatencyMs,
  }));

  return (
    <section
      className="rounded-lg border border-border bg-card p-4"
      aria-label="Latency percentiles over time"
    >
      <h2 className="mb-1 text-sm font-semibold text-foreground">Latency Percentiles</h2>
      <p className="mb-4 text-xs text-muted-foreground">p50 / p90 / p95 / p99 in ms</p>

      {chartData.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          No data for selected range
        </div>
      ) : (
        <div aria-hidden="true">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
                unit="ms"
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "hsl(var(--border))" }} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}
                iconType="circle"
                iconSize={8}
              />
              {LATENCY_LINES.map((line) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.label}
                  stroke={line.color}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="sr-only">
        Latency percentile chart showing p50, p90, p95, and p99 response times over time.
        {data.buckets.length > 0 &&
          ` Latest bucket: p95 ${data.buckets.at(-1)?.p95LatencyMs.toFixed(1)} ms.`}
      </p>
    </section>
  );
}
