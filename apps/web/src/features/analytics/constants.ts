import type { TimeRangePreset } from "@pulsestack/shared";

export interface TimeRangeOption {
  label: string;
  value: TimeRangePreset;
}

export const TIME_RANGE_PRESETS: TimeRangeOption[] = [
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "6h", value: "6h" },
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
];

export interface AutoRefreshOption {
  label: string;
  /** Refresh interval in milliseconds. 0 means off. */
  intervalMs: number;
}

export const AUTO_REFRESH_OPTIONS: AutoRefreshOption[] = [
  { label: "Off", intervalMs: 0 },
  { label: "5s", intervalMs: 5_000 },
  { label: "15s", intervalMs: 15_000 },
  { label: "1m", intervalMs: 60_000 },
];

export const DEFAULT_TIME_RANGE: TimeRangePreset = "1h";
export const DEFAULT_REFRESH_INTERVAL_MS = 0;
