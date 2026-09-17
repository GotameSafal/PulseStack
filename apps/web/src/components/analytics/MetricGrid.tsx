"use client";

import React from "react";
import { MetricCard } from "./MetricCard";
import type { AnalyticsOverviewResponse } from "@pulsestack/shared";

interface MetricGridProps {
  data: AnalyticsOverviewResponse;
  isRefetching?: boolean;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms.toFixed(1)}`;
}

function errorRateIntent(
  rate: number
): "neutral" | "success" | "warning" | "danger" {
  if (rate === 0) return "success";
  if (rate < 5) return "warning";
  return "danger";
}

function latencyIntent(
  p95Ms: number
): "neutral" | "success" | "warning" | "danger" {
  if (p95Ms < 100) return "success";
  if (p95Ms < 500) return "warning";
  return "danger";
}

export function MetricGrid({ data, isRefetching }: MetricGridProps) {
  const errorIntent = errorRateIntent(data.errorRate);
  const latIntent = latencyIntent(data.p95LatencyMs);

  return (
    <section aria-label="Key performance indicators">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Total Requests"
          value={formatNumber(data.totalRequests)}
          detail={`${data.errorRequests} errors`}
          isRefetching={isRefetching}
        />
        <MetricCard
          label="Error Rate"
          value={data.errorRate.toFixed(2)}
          unit="%"
          detail={`${data.errorRequests} of ${data.totalRequests}`}
          intent={errorIntent}
          isRefetching={isRefetching}
        />
        <MetricCard
          label="p95 Latency"
          value={formatLatency(data.p95LatencyMs)}
          unit="ms"
          detail={`p50 ${formatLatency(data.p50LatencyMs)} ms · p99 ${formatLatency(data.p99LatencyMs)} ms`}
          intent={latIntent}
          isRefetching={isRefetching}
        />
        <MetricCard
          label="Throughput"
          value={data.throughputPerSecond.toFixed(2)}
          unit="req/s"
          isRefetching={isRefetching}
        />
      </div>
    </section>
  );
}
