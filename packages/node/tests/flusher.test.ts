import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TelemetryFlusher } from "../src/flusher.js";
import type { TelemetryEvent } from "../src/types.js";

describe("TelemetryFlusher", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const sampleEvent: TelemetryEvent = {
    type: "http_request",
    id: "evt-123",
    timestamp: "2026-09-17T10:00:00.000Z",
    method: "GET",
    path: "/api/health",
    statusCode: 200,
    durationMs: 12.3,
  };

  it("should return success when server responds with 202", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
    });

    const flusher = new TelemetryFlusher({
      apiKey: "ps_live_valid123",
      endpoint: "http://api.local:3001",
    });

    const result = await flusher.sendBatch([sampleEvent]);
    expect(result.success).toBe(true);
    expect(result.shouldRetry).toBe(false);
    expect(result.statusCode).toBe(202);
  });

  it("should not retry on 401 Unauthorized", async () => {
    const onError = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    const flusher = new TelemetryFlusher({
      apiKey: "ps_live_badkey",
      onError,
    });

    const result = await flusher.sendBatch([sampleEvent]);
    expect(result.success).toBe(false);
    expect(result.shouldRetry).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("401") }));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("should not retry on 400 Bad Request", async () => {
    const onError = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
    });

    const flusher = new TelemetryFlusher({
      apiKey: "ps_live_key",
      onError,
    });

    const result = await flusher.sendBatch([sampleEvent]);
    expect(result.success).toBe(false);
    expect(result.shouldRetry).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("should retry on 500 server error up to maxRetries", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 202 });

    const flusher = new TelemetryFlusher({
      apiKey: "ps_live_key",
      maxRetries: 2,
    });

    const result = await flusher.sendBatch([sampleEvent]);
    expect(result.success).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("should isolate network failure and report shouldRetry: true", async () => {
    const onError = vi.fn();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const flusher = new TelemetryFlusher({
      apiKey: "ps_live_key",
      maxRetries: 1,
      onError,
    });

    const result = await flusher.sendBatch([sampleEvent]);
    expect(result.success).toBe(false);
    expect(result.shouldRetry).toBe(true);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "ECONNREFUSED" }));
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
