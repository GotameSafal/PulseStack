import { describe, it, expect, vi, beforeEach } from "vitest";
import { IngestionConsumer, StreamMessageRaw } from "../src/consumer.js";
import { BatchFlusher } from "../src/flusher.js";
import { WorkerConfig } from "../src/config.js";

const mockConfig: WorkerConfig = {
  redisUrl: "redis://localhost:6379",
  streamKey: "telemetry:stream",
  consumerGroup: "cg:ingestion",
  consumerName: "worker-test",
  dlqKey: "telemetry:dlq",
  batchSize: 500,
  blockMs: 100,
  maxRetries: 3,
  claimMinIdleTimeMs: 60000,
  clickhouseUrl: "http://localhost:8123",
};

describe("IngestionConsumer", () => {
  let mockRedis: any;
  let mockFlusher: BatchFlusher;
  let dlqEntries: any[];
  let xackedIds: string[];

  beforeEach(() => {
    dlqEntries = [];
    xackedIds = [];

    mockRedis = {
      xgroup: vi.fn().mockResolvedValue("OK"),
      xadd: vi.fn().mockImplementation(async (key, id, ...fieldValues) => {
        const fields: Record<string, string> = {};
        for (let i = 0; i < fieldValues.length; i += 2) {
          fields[fieldValues[i]] = fieldValues[i + 1];
        }
        dlqEntries.push({ key, id, fields });
        return "dlq-id";
      }),
      xack: vi.fn().mockImplementation(async (stream, group, ...ids) => {
        xackedIds.push(...ids);
        return ids.length;
      }),
      xpending: vi.fn().mockResolvedValue([]),
      xreadgroup: vi.fn(),
    };

    mockFlusher = {
      flush: vi.fn().mockResolvedValue({ successfulIds: [], failedIds: [] }),
    } as any;
  });

  it("parseStreamEntries converts ioredis nested array format correctly", () => {
    const raw = [
      [
        "1694900000000-0",
        ["projectId", "p-1", "data", '{"type":"http_request","id":"1"}'],
      ],
      [
        "1694900000000-1",
        ["projectId", "p-2", "data", '{"type":"error","id":"2"}'],
      ],
    ];

    const parsed = IngestionConsumer.parseStreamEntries(raw);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({
      id: "1694900000000-0",
      fields: {
        projectId: "p-1",
        data: '{"type":"http_request","id":"1"}',
      },
    });
  });

  it("successfully parses valid messages, flushes them, and XACKs", async () => {
    const validHttpMsg: StreamMessageRaw = {
      id: "1-0",
      fields: {
        projectId: "proj-1",
        data: JSON.stringify({
          type: "http_request",
          id: "req-1",
          timestamp: "2026-09-17T12:00:00.000Z",
          method: "GET",
          path: "/users",
          statusCode: 200,
          durationMs: 25,
        }),
      },
    };

    vi.spyOn(mockFlusher, "flush").mockResolvedValue({
      successfulIds: ["1-0"],
      failedIds: [],
    });

    const consumer = new IngestionConsumer({
      config: mockConfig,
      redis: mockRedis,
      flusher: mockFlusher,
    });

    const result = await consumer.processBatch([validHttpMsg]);

    expect(result.processed).toBe(1);
    expect(result.acked).toBe(1);
    expect(result.dlqed).toBe(0);
    expect(mockFlusher.flush).toHaveBeenCalledTimes(1);
    expect(mockRedis.xack).toHaveBeenCalledWith("telemetry:stream", "cg:ingestion", "1-0");
  });

  it("routes malformed JSON directly to DLQ and XACKs from main stream", async () => {
    const badJsonMsg: StreamMessageRaw = {
      id: "2-0",
      fields: {
        projectId: "proj-1",
        data: "{ bad json",
      },
    };

    const consumer = new IngestionConsumer({
      config: mockConfig,
      redis: mockRedis,
      flusher: mockFlusher,
    });

    const result = await consumer.processBatch([badJsonMsg]);

    expect(result.processed).toBe(1);
    expect(result.acked).toBe(0);
    expect(result.dlqed).toBe(1);

    expect(mockFlusher.flush).not.toHaveBeenCalled();
    expect(mockRedis.xadd).toHaveBeenCalledWith(
      "telemetry:dlq",
      "*",
      "streamId",
      "2-0",
      "reason",
      expect.stringContaining("Malformed JSON"),
      "projectId",
      "proj-1",
      "data",
      "{ bad json",
      "failedAt",
      expect.any(String)
    );
    expect(mockRedis.xack).toHaveBeenCalledWith("telemetry:stream", "cg:ingestion", "2-0");
  });

  it("routes missing projectId directly to DLQ and XACKs", async () => {
    const missingProjMsg: StreamMessageRaw = {
      id: "3-0",
      fields: {
        data: JSON.stringify({ type: "http_request", id: "1" }),
      },
    };

    const consumer = new IngestionConsumer({
      config: mockConfig,
      redis: mockRedis,
      flusher: mockFlusher,
    });

    const result = await consumer.processBatch([missingProjMsg]);

    expect(result.dlqed).toBe(1);
    expect(mockRedis.xadd).toHaveBeenCalledWith(
      "telemetry:dlq",
      "*",
      "streamId",
      "3-0",
      "reason",
      "Missing projectId in stream entry",
      "projectId",
      "",
      "data",
      expect.any(String),
      "failedAt",
      expect.any(String)
    );
    expect(mockRedis.xack).toHaveBeenCalledWith("telemetry:stream", "cg:ingestion", "3-0");
  });

  it("routes invalid telemetry schema event directly to DLQ and XACKs", async () => {
    const invalidTelemetryMsg: StreamMessageRaw = {
      id: "4-0",
      fields: {
        projectId: "proj-1",
        data: JSON.stringify({
          type: "http_request",
          id: "req-1",
          // missing timestamp, method, path, statusCode, durationMs
        }),
      },
    };

    const consumer = new IngestionConsumer({
      config: mockConfig,
      redis: mockRedis,
      flusher: mockFlusher,
    });

    const result = await consumer.processBatch([invalidTelemetryMsg]);

    expect(result.dlqed).toBe(1);
    expect(mockRedis.xadd).toHaveBeenCalledWith(
      "telemetry:dlq",
      "*",
      "streamId",
      "4-0",
      "reason",
      expect.stringContaining("Telemetry validation error"),
      "projectId",
      "proj-1",
      "data",
      expect.any(String),
      "failedAt",
      expect.any(String)
    );
    expect(mockRedis.xack).toHaveBeenCalledWith("telemetry:stream", "cg:ingestion", "4-0");
  });

  it("does NOT XACK a message when ClickHouse insert fails and retry limit is not yet reached", async () => {
    const validHttpMsg: StreamMessageRaw = {
      id: "5-0",
      fields: {
        projectId: "proj-1",
        data: JSON.stringify({
          type: "http_request",
          id: "req-1",
          timestamp: "2026-09-17T12:00:00.000Z",
          method: "GET",
          path: "/users",
          statusCode: 200,
          durationMs: 25,
        }),
      },
    };

    // Simulate ClickHouse error
    vi.spyOn(mockFlusher, "flush").mockResolvedValue({
      successfulIds: [],
      failedIds: ["5-0"],
      error: new Error("ClickHouse network failure"),
    });

    // Delivery count is 1 (out of max 3)
    mockRedis.xpending.mockResolvedValue([["5-0", "worker-test", 1000, 1]]);

    const consumer = new IngestionConsumer({
      config: mockConfig,
      redis: mockRedis,
      flusher: mockFlusher,
    });

    const result = await consumer.processBatch([validHttpMsg]);

    expect(result.acked).toBe(0);
    expect(result.dlqed).toBe(0);
    expect(result.failedRetry).toBe(1);
    // Neither XACK nor DLQ should be called for temporary failure
    expect(mockRedis.xack).not.toHaveBeenCalled();
    expect(mockRedis.xadd).not.toHaveBeenCalled();
  });

  it("moves failed message to DLQ and XACKs once MAX_RETRIES is exhausted", async () => {
    const validHttpMsg: StreamMessageRaw = {
      id: "6-0",
      fields: {
        projectId: "proj-1",
        data: JSON.stringify({
          type: "http_request",
          id: "req-1",
          timestamp: "2026-09-17T12:00:00.000Z",
          method: "GET",
          path: "/users",
          statusCode: 200,
          durationMs: 25,
        }),
      },
    };

    vi.spyOn(mockFlusher, "flush").mockResolvedValue({
      successfulIds: [],
      failedIds: ["6-0"],
      error: new Error("Permanent ClickHouse error"),
    });

    // Delivery count is 3 (equal to maxRetries = 3)
    mockRedis.xpending.mockResolvedValue([["6-0", "worker-test", 5000, 3]]);

    const consumer = new IngestionConsumer({
      config: mockConfig,
      redis: mockRedis,
      flusher: mockFlusher,
    });

    const result = await consumer.processBatch([validHttpMsg]);

    expect(result.dlqed).toBe(1);
    expect(mockRedis.xadd).toHaveBeenCalledWith(
      "telemetry:dlq",
      "*",
      "streamId",
      "6-0",
      "reason",
      expect.stringContaining("ClickHouse flush failed after 3 deliveries"),
      "projectId",
      "proj-1",
      "data",
      expect.any(String),
      "failedAt",
      expect.any(String)
    );
    expect(mockRedis.xack).toHaveBeenCalledWith("telemetry:stream", "cg:ingestion", "6-0");
  });

  it("initConsumerGroup swallows BUSYGROUP error gracefully", async () => {
    mockRedis.xgroup.mockRejectedValue(new Error("BUSYGROUP Consumer Group name already exists"));

    const consumer = new IngestionConsumer({
      config: mockConfig,
      redis: mockRedis,
      flusher: mockFlusher,
    });

    await expect(consumer.initConsumerGroup()).resolves.toBeUndefined();
  });
});
