import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PulseStackClient } from "../src/client.js";

describe("PulseStackClient", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should throw if apiKey is missing and not disabled", () => {
    expect(() => new PulseStackClient({ apiKey: "" })).toThrow(/apiKey is required/);
  });

  it("should allow missing apiKey if disabled is true", () => {
    const client = new PulseStackClient({ apiKey: "", disabled: true });
    expect(client).toBeDefined();
    client.recordHttpRequest({ method: "GET", path: "/test", statusCode: 200, durationMs: 10 });
    expect(client.pendingEventsCount).toBe(0);
  });

  it("should enqueue events and trigger flush when batch size is reached", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ accepted: 3 }),
    });
    globalThis.fetch = fetchMock;

    const client = new PulseStackClient({
      apiKey: "ps_live_testkey123456",
      maxBatchSize: 3,
      flushIntervalMs: 10000,
    });

    client.recordHttpRequest({ method: "GET", path: "/1", statusCode: 200, durationMs: 10 });
    client.recordHttpRequest({ method: "GET", path: "/2", statusCode: 200, durationMs: 15 });
    expect(client.pendingEventsCount).toBe(2);
    expect(fetchMock).not.toHaveBeenCalled();

    // 3rd event reaches maxBatchSize = 3
    client.recordHttpRequest({ method: "GET", path: "/3", statusCode: 200, durationMs: 20 });

    // Allow promise microtasks to run
    await client.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, req] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:3001/v1/ingest");
    expect(req.headers.Authorization).toBe("Bearer ps_live_testkey123456");

    const body = JSON.parse(req.body);
    expect(body.events).toHaveLength(3);
    expect(body.events[0].path).toBe("/1");
    expect(body.events[1].path).toBe("/2");
    expect(body.events[2].path).toBe("/3");
    expect(client.pendingEventsCount).toBe(0);

    await client.close();
  });

  it("should flush periodically on timer tick", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ accepted: 1 }),
    });
    globalThis.fetch = fetchMock;

    const client = new PulseStackClient({
      apiKey: "ps_live_testkey123456",
      maxBatchSize: 10,
      flushIntervalMs: 1000,
    });

    client.captureError(new Error("Crash test"));
    expect(client.pendingEventsCount).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();

    // Advance timer past flushIntervalMs
    await vi.advanceTimersByTimeAsync(1100);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.pendingEventsCount).toBe(0);

    await client.close();
  });

  it("should capture errors and format error payload properly", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
    });
    globalThis.fetch = fetchMock;

    const client = new PulseStackClient({
      apiKey: "ps_live_testkey123456",
      maxBatchSize: 1,
    });

    const testError = new TypeError("Invalid argument");
    client.captureError(testError, { handled: true, context: { user: "john" } });

    await client.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const event = body.events[0];

    expect(event.type).toBe("error");
    expect(event.name).toBe("TypeError");
    expect(event.message).toBe("Invalid argument");
    expect(event.handled).toBe(true);
    expect(event.context).toEqual({ user: "john" });
    expect(event.stack).toBeDefined();

    await client.close();
  });

  it("should drain remaining events gracefully on close()", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
    });
    globalThis.fetch = fetchMock;

    const client = new PulseStackClient({
      apiKey: "ps_live_testkey123456",
      maxBatchSize: 100,
      flushIntervalMs: 50000,
    });

    client.captureEvent("test.event", { score: 99 });
    expect(client.pendingEventsCount).toBe(1);

    await client.close();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.pendingEventsCount).toBe(0);

    // Calling close multiple times should be idempotent
    await client.close();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
