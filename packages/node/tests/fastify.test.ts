import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import { PulseStackClient } from "../src/client.js";
import { pulseStackFastifyPlugin } from "../src/middleware/fastify.js";

describe("pulseStackFastifyPlugin", () => {
  let client: PulseStackClient;
  let recordMock: ReturnType<typeof vi.fn>;
  let captureMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new PulseStackClient({ apiKey: "ps_live_test", disabled: true });
    recordMock = vi.spyOn(client, "recordHttpRequest") as unknown as ReturnType<typeof vi.fn>;
    captureMock = vi.spyOn(client, "captureError") as unknown as ReturnType<typeof vi.fn>;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  async function buildApp() {
    const app = Fastify({ logger: false });
    await app.register(pulseStackFastifyPlugin, { client });
    return app;
  }

  it("records a successful GET request", async () => {
    const app = await buildApp();

    app.get("/health", async () => ({ ok: true }));
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);

    expect(recordMock).toHaveBeenCalledTimes(1);
    const call = recordMock.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/health");
    expect(call.statusCode).toBe(200);
    expect(call.durationMs).toBeGreaterThanOrEqual(0);

    await app.close();
  });

  it("records a POST request with path", async () => {
    const app = await buildApp();

    app.post("/v1/submit", async (_req, reply) => {
      reply.status(201);
      return { created: true };
    });
    await app.ready();

    const res = await app.inject({ method: "POST", url: "/v1/submit" });
    expect(res.statusCode).toBe(201);

    expect(recordMock).toHaveBeenCalledTimes(1);
    const call = recordMock.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/v1/submit");
    expect(call.statusCode).toBe(201);

    await app.close();
  });

  it("extracts x-forwarded-for as client IP", async () => {
    const app = await buildApp();
    app.get("/ip", async () => "ok");
    await app.ready();

    await app.inject({
      method: "GET",
      url: "/ip",
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });

    const call = recordMock.mock.calls[0][0];
    expect(call.clientIp).toBe("203.0.113.5");

    await app.close();
  });

  it("captures unhandled route errors via onError hook", async () => {
    const app = await buildApp();

    app.get("/crash", async () => {
      throw new Error("something exploded");
    });
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/crash" });
    expect(res.statusCode).toBe(500);

    expect(captureMock).toHaveBeenCalledTimes(1);
    const [capturedError, opts] = captureMock.mock.calls[0];
    expect(capturedError).toBeInstanceOf(Error);
    expect((capturedError as Error).message).toBe("something exploded");
    expect(opts).toEqual({ handled: false });

    await app.close();
  });

  it("records telemetry for 404 not-found responses", async () => {
    const app = await buildApp();
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/nonexistent" });
    expect(res.statusCode).toBe(404);

    expect(recordMock).toHaveBeenCalledTimes(1);
    const call = recordMock.mock.calls[0][0];
    expect(call.statusCode).toBe(404);

    await app.close();
  });
});
