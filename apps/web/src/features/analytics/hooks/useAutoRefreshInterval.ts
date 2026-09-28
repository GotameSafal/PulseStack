import { useState, useEffect } from "react";
import { DEFAULT_REFRESH_INTERVAL_MS } from "@/features/analytics/constants";

const STORAGE_KEY = "pulsestack_refresh_interval_ms";

/**
 * Hook to persist the user's selected auto-refresh interval across page tabs and navigation.
 * Defaults to DEFAULT_REFRESH_INTERVAL_MS (0 = Off).
 */
export function useAutoRefreshInterval(): [number, (interval: number) => void] {
  const [intervalMs, setIntervalMsState] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_REFRESH_INTERVAL_MS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const parsed = Number(stored);
        if (!isNaN(parsed) && [0, 5000, 15000, 60000].includes(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Fallback on storage errors
    }
    return DEFAULT_REFRESH_INTERVAL_MS;
  });

  const setIntervalMs = (newInterval: number) => {
    setIntervalMsState(newInterval);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, String(newInterval));
      } catch {
        // Ignore storage errors
      }
    }
  };

  return [intervalMs, setIntervalMs];
}
