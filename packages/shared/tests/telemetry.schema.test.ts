import { describe, it, expect } from "vitest";
import {
  HttpRequestEventSchema,
  ErrorEventSchema,
  DatabaseQueryEventSchema,
  BackgroundJobEventSchema,
  CustomEventSchema,
  TelemetryEventSchema,
  IngestBatchPayloadSchema,
} from "../src";

describe("Telemetry Schemas (Phase 2)", () => {
  describe("HttpRequestEventSchema", () => {
    it("validates a complete valid HTTP request event", () => {
      const validEvent = {
        type: "http_request",
        id: "evt_12345",
        timestamp: new Date().toISOString(),
        method: "POST",
        path: "/api/checkout",
        statusCode: 201,
        durationMs: 142.5,
        clientIp: "192.168.1.1",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        headers: { "content-type": "application/json" },
        queryParams: { ref: "campaign_1" },
        requestBodySize: 1024,
        responseBodySize: 512,
      };

      const res = HttpRequestEventSchema.safeParse(validEvent);
      expect(res.success).toBe(true);
    });

    it("validates a minimal valid HTTP request event", () => {
      const minimalEvent = {
        type: "http_request",
        id: "evt_minimal",
        timestamp: new Date(),
        method: "GET",
        path: "/health",
        statusCode: 200,
        durationMs: 1.2,
      };

      const res = HttpRequestEventSchema.safeParse(minimalEvent);
      expect(res.success).toBe(true);
    });

    it("rejects HTTP request event with invalid HTTP method", () => {
      const invalidEvent = {
        type: "http_request",
        id: "evt_inv",
        timestamp: new Date().toISOString(),
        method: "INVALID_METHOD",
        path: "/test",
        statusCode: 200,
        durationMs: 10,
      };

      const res = HttpRequestEventSchema.safeParse(invalidEvent);
      expect(res.success).toBe(false);
    });

    it("rejects HTTP request event with negative duration", () => {
      const invalidEvent = {
        type: "http_request",
        id: "evt_neg",
        timestamp: new Date().toISOString(),
        method: "GET",
        path: "/test",
        statusCode: 200,
        durationMs: -5,
      };

      const res = HttpRequestEventSchema.safeParse(invalidEvent);
      expect(res.success).toBe(false);
    });

    it("rejects HTTP request event with invalid status code range", () => {
      const invalidEvent = {
        type: "http_request",
        id: "evt_code",
        timestamp: new Date().toISOString(),
        method: "GET",
        path: "/test",
        statusCode: 999,
        durationMs: 10,
      };

      const res = HttpRequestEventSchema.safeParse(invalidEvent);
      expect(res.success).toBe(false);
    });
  });

  describe("ErrorEventSchema", () => {
    it("validates an error event", () => {
      const validError = {
        type: "error",
        id: "err_12345",
        timestamp: new Date().toISOString(),
        name: "DatabaseConnectionTimeout",
        message: "Failed to acquire client from pool within 5000ms",
        stack: "Error: Failed...\n at Pool.connect (/app/node_modules/...)",
        fingerprint: "db_timeout_pool",
        handled: false,
        context: { poolSize: 10, waitingRequests: 25 },
      };

      const res = ErrorEventSchema.safeParse(validError);
      expect(res.success).toBe(true);
    });
  });

  describe("DatabaseQueryEventSchema", () => {
    it("validates a database query event", () => {
      const validQuery = {
        type: "database_query",
        id: "dbq_12345",
        timestamp: new Date().toISOString(),
        query: "SELECT * FROM users WHERE id = $1",
        durationMs: 14.8,
        table: "users",
        driver: "postgres",
        rowsAffected: 1,
      };

      const res = DatabaseQueryEventSchema.safeParse(validQuery);
      expect(res.success).toBe(true);
    });
  });

  describe("BackgroundJobEventSchema", () => {
    it("validates a background job event", () => {
      const validJob = {
        type: "background_job",
        id: "job_12345",
        timestamp: new Date().toISOString(),
        queue: "email_notifications",
        name: "SendWelcomeEmail",
        durationMs: 340.2,
        status: "completed",
        attempts: 1,
      };

      const res = BackgroundJobEventSchema.safeParse(validJob);
      expect(res.success).toBe(true);
    });
  });

  describe("CustomEventSchema", () => {
    it("validates a custom telemetry event", () => {
      const validCustom = {
        type: "custom_event",
        id: "cust_12345",
        timestamp: new Date().toISOString(),
        name: "user_upgraded_plan",
        payload: { tier: "enterprise", annualBilling: true },
        attributes: { source: "web_checkout" },
      };

      const res = CustomEventSchema.safeParse(validCustom);
      expect(res.success).toBe(true);
    });
  });

  describe("TelemetryEventSchema (Discriminated Union)", () => {
    it("parses valid events via discriminated union", () => {
      const httpEvent = {
        type: "http_request",
        id: "evt_1",
        timestamp: new Date().toISOString(),
        method: "GET",
        path: "/users",
        statusCode: 200,
        durationMs: 15,
      };

      const parsed = TelemetryEventSchema.safeParse(httpEvent);
      expect(parsed.success).toBe(true);
    });

    it("rejects event with unknown type", () => {
      const unknownEvent = {
        type: "unknown_future_event",
        id: "evt_x",
        timestamp: new Date().toISOString(),
      };

      const parsed = TelemetryEventSchema.safeParse(unknownEvent);
      expect(parsed.success).toBe(false);
    });
  });

  describe("IngestBatchPayloadSchema", () => {
    it("validates a batch containing single and multiple events", () => {
      const batch = {
        sentAt: new Date().toISOString(),
        events: [
          {
            type: "http_request",
            id: "evt_1",
            timestamp: new Date().toISOString(),
            method: "GET",
            path: "/api/v1/projects",
            statusCode: 200,
            durationMs: 25.4,
          },
          {
            type: "error",
            id: "evt_2",
            timestamp: new Date().toISOString(),
            name: "TypeError",
            message: "Cannot read properties of undefined",
            handled: true,
          },
        ],
      };

      const res = IngestBatchPayloadSchema.safeParse(batch);
      expect(res.success).toBe(true);
    });

    it("rejects batch with empty events array", () => {
      const emptyBatch = {
        events: [],
      };

      const res = IngestBatchPayloadSchema.safeParse(emptyBatch);
      expect(res.success).toBe(false);
    });
  });
});
