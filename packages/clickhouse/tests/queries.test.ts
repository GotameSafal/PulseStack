import { describe, it, expect, vi } from "vitest";
import {
  buildOverviewQuery,
  queryOverviewMetrics,
  buildTimeSeriesQuery,
  queryTimeSeriesMetrics,
  buildRequestExplorerQuery,
  queryRequestExplorerLogs,
  buildErrorExplorerQuery,
  queryErrorGroups,
} from "../src";

describe("ClickHouse Analytics Query Builders", () => {
  const projectId = "proj-test-123";
  const from = new Date("2026-09-17T10:00:00.000Z");
  const to = new Date("2026-09-17T11:00:00.000Z");

  describe("Overview Query Builder", () => {
    it("builds parameterized overview SQL with expected metrics", () => {
      const { query, query_params } = buildOverviewQuery({ projectId, from, to });

      expect(query).toContain("count() AS total_requests");
      expect(query).toContain("countIf(status_code >= 400) AS error_requests");
      expect(query).toContain("quantile(0.50)(duration_ms)");
      expect(query).toContain("quantile(0.90)(duration_ms)");
      expect(query).toContain("quantile(0.95)(duration_ms)");
      expect(query).toContain("quantile(0.99)(duration_ms)");
      expect(query).toContain("status_2xx");
      expect(query).toContain("status_3xx");
      expect(query).toContain("status_4xx");
      expect(query).toContain("status_5xx");
      expect(query).toContain("project_id = {projectId: String}");
      expect(query).toContain("timestamp >= {from: DateTime64(3, 'UTC')}");
      expect(query).toContain("timestamp <= {to: DateTime64(3, 'UTC')}");

      expect(query_params.projectId).toBe(projectId);
      expect(query_params.from).toBe("2026-09-17 10:00:00.000");
      expect(query_params.to).toBe("2026-09-17 11:00:00.000");
    });

    it("executes query and maps raw ClickHouse response to AnalyticsOverviewResponse", async () => {
      const mockResult = {
        total_requests: 3600,
        error_requests: 36,
        error_rate: 1.0,
        p50_latency: 15.2,
        p90_latency: 42.1,
        p95_latency: 78.5,
        p99_latency: 180.0,
        status_2xx: 3500,
        status_3xx: 64,
        status_4xx: 30,
        status_5xx: 6,
      };

      const mockClient = {
        query: vi.fn().mockResolvedValue({
          json: async () => [mockResult],
        }),
      } as any;

      const res = await queryOverviewMetrics(mockClient, { projectId, from, to });

      expect(res.projectId).toBe(projectId);
      expect(res.totalRequests).toBe(3600);
      expect(res.errorRequests).toBe(36);
      expect(res.errorRate).toBe(1.0);
      expect(res.throughputPerSecond).toBe(1.0); // 3600 requests over 3600s = 1.0 req/s
      expect(res.p50LatencyMs).toBe(15.2);
      expect(res.p95LatencyMs).toBe(78.5);
      expect(res.p99LatencyMs).toBe(180.0);
      expect(res.statusBreakdown.status2xx).toBe(3500);
      expect(res.statusBreakdown.status5xx).toBe(6);
    });
  });

  describe("TimeSeries Query Builder", () => {
    it("builds parameterized time series SQL with interval", () => {
      const { query, query_params } = buildTimeSeriesQuery({
        projectId,
        from,
        to,
        intervalMinutes: 10,
      });

      expect(query).toContain("toStartOfInterval(timestamp, INTERVAL {intervalMinutes: UInt32} MINUTE)");
      expect(query).toContain("GROUP BY bucket_time");
      expect(query).toContain("ORDER BY bucket_time ASC");
      expect(query_params.intervalMinutes).toBe(10);
      expect(query_params.projectId).toBe(projectId);
    });

    it("executes time series query and formats bucket dates to ISO strings", async () => {
      const mockRows = [
        {
          bucket_time: "2026-09-17 10:00:00",
          request_count: 50,
          error_count: 1,
          error_rate: 2.0,
          p50: 12.5,
          p90: 25.0,
          p95: 35.0,
          p99: 90.0,
        },
      ];

      const mockClient = {
        query: vi.fn().mockResolvedValue({
          json: async () => mockRows,
        }),
      } as any;

      const res = await queryTimeSeriesMetrics(mockClient, {
        projectId,
        from,
        to,
        intervalMinutes: 5,
      });

      expect(res.intervalMinutes).toBe(5);
      expect(res.buckets).toHaveLength(1);
      expect(res.buckets[0]?.bucket).toBe("2026-09-17T10:00:00.000Z");
      expect(res.buckets[0]?.requestCount).toBe(50);
      expect(res.buckets[0]?.p95LatencyMs).toBe(35.0);
    });
  });

  describe("Request Explorer Query Builder", () => {
    it("builds parameterized request query with optional filters", () => {
      const { dataQuery, countQuery, query_params } = buildRequestExplorerQuery({
        projectId,
        from,
        to,
        method: "get",
        statusCode: 404,
        pathPrefix: "/api/v1",
        minDurationMs: 50,
        limit: 25,
        offset: 10,
      });

      expect(dataQuery).toContain("method = {method: String}");
      expect(dataQuery).toContain("status_code = {statusCode: UInt16}");
      expect(dataQuery).toContain("startsWith(path, {pathPrefix: String})");
      expect(dataQuery).toContain("duration_ms >= {minDurationMs: Float64}");
      expect(dataQuery).toContain("ORDER BY (project_id, timestamp, id) DESC");
      expect(dataQuery).toContain("LIMIT {limit: UInt32} OFFSET {offset: UInt32}");

      expect(countQuery).toContain("SELECT count() AS total_count");

      expect(query_params.method).toBe("GET");
      expect(query_params.statusCode).toBe(404);
      expect(query_params.pathPrefix).toBe("/api/v1");
      expect(query_params.minDurationMs).toBe(50);
      expect(query_params.limit).toBe(25);
      expect(query_params.offset).toBe(10);
    });

    it("supports statusClass filter when specific statusCode is omitted", () => {
      const { dataQuery } = buildRequestExplorerQuery({
        projectId,
        from,
        to,
        statusClass: "5xx",
      });

      expect(dataQuery).toContain("status_code >= 500");
    });

    it("executes data and count queries concurrently and returns paginated response", async () => {
      const mockItems = [
        {
          id: "req-1",
          project_id: projectId,
          timestamp: "2026-09-17 10:15:00",
          method: "GET",
          path: "/users",
          status_code: 200,
          duration_ms: 12.3,
          client_ip: "10.0.0.1",
          user_agent: "PulseClient",
          headers: { host: "api.pulsestack.dev" },
          query_params: {},
          request_body_size: null,
          response_body_size: 256,
        },
      ];

      const mockClient = {
        query: vi.fn().mockImplementation(async ({ query }) => {
          if (query.includes("count() AS total_count")) {
            return { json: async () => [{ total_count: 142 }] };
          }
          return { json: async () => mockItems };
        }),
      } as any;

      const res = await queryRequestExplorerLogs(mockClient, {
        projectId,
        from,
        to,
        limit: 10,
        offset: 0,
      });

      expect(res.totalCount).toBe(142);
      expect(res.items).toHaveLength(1);
      expect(res.items[0]?.id).toBe("req-1");
      expect(res.items[0]?.timestamp).toBe("2026-09-17T10:15:00.000Z");
      expect(res.items[0]?.statusCode).toBe(200);
    });
  });

  describe("Error Explorer Query Builder", () => {
    it("builds parameterized error groups and totals SQL", () => {
      const { groupsQuery, totalsQuery, query_params } = buildErrorExplorerQuery({
        projectId,
        from,
        to,
        handled: false,
        limit: 20,
      });

      expect(groupsQuery).toContain("coalesce(nullIf(fingerprint, ''), name) AS group_key");
      expect(groupsQuery).toContain("handled = {handled: Bool}");
      expect(groupsQuery).toContain("GROUP BY group_key, name");
      expect(groupsQuery).toContain("ORDER BY occurrences DESC");
      expect(groupsQuery).toContain("LIMIT {limit: UInt32}");

      expect(totalsQuery).toContain("count() AS total_errors");
      expect(totalsQuery).toContain("uniqExact(coalesce(nullIf(fingerprint, ''), name)) AS unique_groups");

      expect(query_params.handled).toBe(false);
      expect(query_params.limit).toBe(20);
    });

    it("executes error explorer query and maps groups correctly", async () => {
      const mockGroups = [
        {
          group_key: "timeout_pool",
          name: "ConnectionTimeout",
          sample_message: "Pool timeout",
          sample_stack: "Error: Pool timeout at pool.ts",
          occurrences: 25,
          first_seen: "2026-09-17 10:05:00",
          last_seen: "2026-09-17 10:55:00",
          handled: 0,
        },
      ];

      const mockClient = {
        query: vi.fn().mockImplementation(async ({ query }) => {
          if (query.includes("total_errors")) {
            return { json: async () => [{ total_errors: 25, unique_groups: 1 }] };
          }
          return { json: async () => mockGroups };
        }),
      } as any;

      const res = await queryErrorGroups(mockClient, { projectId, from, to });

      expect(res.totalErrors).toBe(25);
      expect(res.uniqueGroups).toBe(1);
      expect(res.groups).toHaveLength(1);
      expect(res.groups[0]?.groupKey).toBe("timeout_pool");
      expect(res.groups[0]?.firstSeen).toBe("2026-09-17T10:05:00.000Z");
      expect(res.groups[0]?.handled).toBe(false);
    });
  });
});
