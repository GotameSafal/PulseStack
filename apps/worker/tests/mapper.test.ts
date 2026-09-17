import { describe, it, expect } from "vitest";
import {
  mapHttpRequest,
  mapError,
  mapDatabaseQuery,
  mapBackgroundJob,
  mapCustomEvent,
  mapTelemetryEvent,
  formatDateTime64,
} from "../src/mapper.js";
import {
  HttpRequestEvent,
  ErrorEvent,
  DatabaseQueryEvent,
  BackgroundJobEvent,
  CustomEvent,
} from "@pulsestack/shared";

describe("formatDateTime64", () => {
  it("formats ISO string correctly into ClickHouse DateTime64 UTC format", () => {
    const iso = "2026-09-17T12:34:56.789Z";
    const formatted = formatDateTime64(iso);
    expect(formatted).toBe("2026-09-17 12:34:56.789");
  });

  it("formats Date object correctly into ClickHouse DateTime64 UTC format", () => {
    const d = new Date("2026-01-01T00:00:00.000Z");
    const formatted = formatDateTime64(d);
    expect(formatted).toBe("2026-01-01 00:00:00.000");
  });

  it("throws on invalid timestamp", () => {
    expect(() => formatDateTime64("invalid-date")).toThrow("Invalid timestamp");
  });
});

describe("mapHttpRequest", () => {
  const event: HttpRequestEvent = {
    type: "http_request",
    id: "req-123",
    timestamp: "2026-09-17T12:00:00.123Z",
    method: "POST",
    path: "/v1/test",
    statusCode: 201,
    durationMs: 45.6,
    clientIp: "192.168.1.1",
    userAgent: "Mozilla/5.0",
    headers: { "content-type": "application/json" },
    queryParams: { filter: "active" },
    requestBodySize: 1024,
    responseBodySize: 2048,
  };

  it("correctly maps camelCase to snake_case ClickHouse columns", () => {
    const result = mapHttpRequest(event, "proj-abc");
    expect(result.table).toBe("http_requests");
    expect(result.row).toEqual({
      id: "req-123",
      project_id: "proj-abc",
      timestamp: "2026-09-17 12:00:00.123",
      method: "POST",
      path: "/v1/test",
      status_code: 201,
      duration_ms: 45.6,
      client_ip: "192.168.1.1",
      user_agent: "Mozilla/5.0",
      headers: { "content-type": "application/json" },
      query_params: { filter: "active" },
      request_body_size: 1024,
      response_body_size: 2048,
    });
  });

  it("handles optional fields with appropriate null / default fallback", () => {
    const minimalEvent: HttpRequestEvent = {
      type: "http_request",
      id: "req-min",
      timestamp: "2026-09-17T12:00:00.000Z",
      method: "GET",
      path: "/health",
      statusCode: 200,
      durationMs: 5.0,
    };
    const result = mapHttpRequest(minimalEvent, "proj-abc");
    expect(result.row.client_ip).toBeNull();
    expect(result.row.user_agent).toBeNull();
    expect(result.row.headers).toEqual({});
    expect(result.row.query_params).toEqual({});
    expect(result.row.request_body_size).toBeNull();
    expect(result.row.response_body_size).toBeNull();
  });
});

describe("mapError", () => {
  it("serializes context as JSON string and sets handled boolean", () => {
    const event: ErrorEvent = {
      type: "error",
      id: "err-1",
      timestamp: "2026-09-17T12:00:00.000Z",
      name: "DatabaseTimeout",
      message: "Connection timed out",
      stack: "Error: Connection timed out\n  at db.ts:10",
      fingerprint: "db-timeout-1",
      handled: true,
      context: { retries: 3, host: "db1" },
    };

    const result = mapError(event, "proj-abc");
    expect(result.table).toBe("errors");
    expect(result.row.id).toBe("err-1");
    expect(result.row.project_id).toBe("proj-abc");
    expect(result.row.name).toBe("DatabaseTimeout");
    expect(result.row.handled).toBe(true);
    expect(result.row.context).toBe(JSON.stringify({ retries: 3, host: "db1" }));
  });
});

describe("mapDatabaseQuery", () => {
  it("maps table to table_name column", () => {
    const event: DatabaseQueryEvent = {
      type: "database_query",
      id: "dbq-1",
      timestamp: "2026-09-17T12:00:00.000Z",
      query: "SELECT * FROM users WHERE id = $1",
      durationMs: 14.2,
      table: "users",
      driver: "pg",
      rowsAffected: 1,
    };

    const result = mapDatabaseQuery(event, "proj-abc");
    expect(result.table).toBe("database_queries");
    expect(result.row.table_name).toBe("users");
    expect(result.row.driver).toBe("pg");
    expect(result.row.rows_affected).toBe(1);
  });
});

describe("mapBackgroundJob", () => {
  it("maps all background job fields", () => {
    const event: BackgroundJobEvent = {
      type: "background_job",
      id: "job-1",
      timestamp: "2026-09-17T12:00:00.000Z",
      queue: "emails",
      name: "SendWelcomeEmail",
      durationMs: 250,
      status: "completed",
      attempts: 2,
    };

    const result = mapBackgroundJob(event, "proj-abc");
    expect(result.table).toBe("background_jobs");
    expect(result.row.queue).toBe("emails");
    expect(result.row.status).toBe("completed");
    expect(result.row.attempts).toBe(2);
  });
});

describe("mapCustomEvent", () => {
  it("serializes payload as JSON string and passes attributes", () => {
    const event: CustomEvent = {
      type: "custom_event",
      id: "ce-1",
      timestamp: "2026-09-17T12:00:00.000Z",
      name: "signup_completed",
      payload: { plan: "pro", referrer: "google" },
      attributes: { tier: "premium" },
    };

    const result = mapCustomEvent(event, "proj-abc");
    expect(result.table).toBe("custom_events");
    expect(result.row.payload).toBe(JSON.stringify({ plan: "pro", referrer: "google" }));
    expect(result.row.attributes).toEqual({ tier: "premium" });
  });
});

describe("mapTelemetryEvent dispatcher", () => {
  it("correctly dispatches each discriminated union variant", () => {
    const httpEvt: HttpRequestEvent = {
      type: "http_request",
      id: "h-1",
      timestamp: "2026-09-17T00:00:00Z",
      method: "GET",
      path: "/",
      statusCode: 200,
      durationMs: 1,
    };
    expect(mapTelemetryEvent(httpEvt, "p").table).toBe("http_requests");
  });
});
