import { describe, it, expect } from "vitest";
import {
  TimeRangePresetEnum,
  parseTimeRangePreset,
  AnalyticsQueryFilterSchema,
  AnalyticsOverviewResponseSchema,
  AnalyticsTimeSeriesResponseSchema,
  RequestExplorerQuerySchema,
  RequestExplorerResponseSchema,
  ErrorExplorerQuerySchema,
  ErrorExplorerResponseSchema,
} from "../src";

describe("Analytics Schemas & Preset Helpers", () => {
  describe("TimeRangePresetEnum & parseTimeRangePreset", () => {
    it("parses 15m preset correctly", () => {
      const now = new Date("2026-09-17T12:00:00.000Z");
      const { from, to, intervalMinutes } = parseTimeRangePreset("15m", now);

      expect(to.toISOString()).toBe("2026-09-17T12:00:00.000Z");
      expect(from.toISOString()).toBe("2026-09-17T11:45:00.000Z");
      expect(intervalMinutes).toBe(1);
    });

    it("parses 1h preset correctly", () => {
      const now = new Date("2026-09-17T12:00:00.000Z");
      const { from, to, intervalMinutes } = parseTimeRangePreset("1h", now);

      expect(from.toISOString()).toBe("2026-09-17T11:00:00.000Z");
      expect(intervalMinutes).toBe(2);
    });

    it("parses 6h preset correctly", () => {
      const now = new Date("2026-09-17T12:00:00.000Z");
      const { from, to, intervalMinutes } = parseTimeRangePreset("6h", now);

      expect(from.toISOString()).toBe("2026-09-17T06:00:00.000Z");
      expect(intervalMinutes).toBe(10);
    });

    it("parses 24h preset correctly", () => {
      const now = new Date("2026-09-17T12:00:00.000Z");
      const { from, to, intervalMinutes } = parseTimeRangePreset("24h", now);

      expect(from.toISOString()).toBe("2026-09-16T12:00:00.000Z");
      expect(intervalMinutes).toBe(30);
    });

    it("parses 7d preset correctly", () => {
      const now = new Date("2026-09-17T12:00:00.000Z");
      const { from, to, intervalMinutes } = parseTimeRangePreset("7d", now);

      expect(from.toISOString()).toBe("2026-09-10T12:00:00.000Z");
      expect(intervalMinutes).toBe(180);
    });

    it("validates all supported presets in schema", () => {
      const presets = ["15m", "1h", "6h", "24h", "7d"];
      for (const p of presets) {
        expect(TimeRangePresetEnum.safeParse(p).success).toBe(true);
      }
      expect(TimeRangePresetEnum.safeParse("30d").success).toBe(false);
    });
  });

  describe("AnalyticsOverviewResponseSchema", () => {
    it("validates a complete overview response payload", () => {
      const valid = {
        projectId: "proj-1",
        from: "2026-09-17T11:00:00.000Z",
        to: "2026-09-17T12:00:00.000Z",
        totalRequests: 15400,
        errorRequests: 32,
        errorRate: 0.21,
        throughputPerSecond: 4.28,
        p50LatencyMs: 14.5,
        p90LatencyMs: 45.2,
        p95LatencyMs: 82.0,
        p99LatencyMs: 240.1,
        statusBreakdown: {
          status2xx: 15300,
          status3xx: 68,
          status4xx: 28,
          status5xx: 4,
        },
      };

      const res = AnalyticsOverviewResponseSchema.safeParse(valid);
      expect(res.success).toBe(true);
    });

    it("rejects negative latency or invalid counts", () => {
      const invalid = {
        projectId: "proj-1",
        from: "2026-09-17T11:00:00.000Z",
        to: "2026-09-17T12:00:00.000Z",
        totalRequests: -1,
        errorRequests: 0,
        errorRate: -5,
        throughputPerSecond: 0,
        p50LatencyMs: -1,
        p90LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        statusBreakdown: { status2xx: 0, status3xx: 0, status4xx: 0, status5xx: 0 },
      };

      const res = AnalyticsOverviewResponseSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });
  });

  describe("AnalyticsTimeSeriesResponseSchema", () => {
    it("validates time series bucketed response", () => {
      const valid = {
        projectId: "proj-1",
        from: "2026-09-17T11:00:00.000Z",
        to: "2026-09-17T12:00:00.000Z",
        intervalMinutes: 5,
        buckets: [
          {
            bucket: "2026-09-17T11:00:00.000Z",
            requestCount: 500,
            errorCount: 2,
            errorRate: 0.4,
            p50LatencyMs: 12.0,
            p90LatencyMs: 28.0,
            p95LatencyMs: 45.0,
            p99LatencyMs: 120.0,
          },
          {
            bucket: "2026-09-17T11:05:00.000Z",
            requestCount: 650,
            errorCount: 0,
            errorRate: 0.0,
            p50LatencyMs: 11.5,
            p90LatencyMs: 25.0,
            p95LatencyMs: 38.0,
            p99LatencyMs: 95.0,
          },
        ],
      };

      const res = AnalyticsTimeSeriesResponseSchema.safeParse(valid);
      expect(res.success).toBe(true);
    });
  });

  describe("RequestExplorerQuerySchema & Response", () => {
    it("coerces and defaults pagination and query filters", () => {
      const query = {
        limit: "25",
        offset: "50",
        statusCode: "404",
        minDurationMs: "100.5",
      };

      const parsed = RequestExplorerQuerySchema.safeParse(query);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.limit).toBe(25);
        expect(parsed.data.offset).toBe(50);
        expect(parsed.data.statusCode).toBe(404);
        expect(parsed.data.minDurationMs).toBe(100.5);
      }
    });

    it("validates request explorer item and response payload", () => {
      const valid = {
        items: [
          {
            id: "req-1",
            projectId: "proj-1",
            timestamp: "2026-09-17T12:00:00.000Z",
            method: "POST",
            path: "/api/checkout",
            statusCode: 201,
            durationMs: 84.2,
            clientIp: "127.0.0.1",
            userAgent: "Mozilla/5.0",
            headers: { authorization: "Bearer ..." },
            queryParams: { ref: "direct" },
            requestBodySize: 512,
            responseBodySize: 1024,
          },
        ],
        totalCount: 1,
        limit: 50,
        offset: 0,
      };

      const res = RequestExplorerResponseSchema.safeParse(valid);
      expect(res.success).toBe(true);
    });
  });

  describe("ErrorExplorerQuerySchema & Response", () => {
    it("validates error grouping summary response", () => {
      const valid = {
        groups: [
          {
            groupKey: "db_connection_timeout",
            name: "DatabaseTimeoutError",
            sampleMessage: "Connection pool exhausted",
            sampleStack: "Error: Connection pool exhausted\n at pool.ts:45",
            occurrences: 48,
            firstSeen: "2026-09-17T10:00:00.000Z",
            lastSeen: "2026-09-17T11:58:00.000Z",
            handled: false,
          },
        ],
        totalErrors: 48,
        uniqueGroups: 1,
      };

      const res = ErrorExplorerResponseSchema.safeParse(valid);
      expect(res.success).toBe(true);
    });
  });
});
