import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { PulseStackClient } from "../src/client.js";
import {
  pulseStackExpressMiddleware,
  pulseStackExpressErrorHandler,
} from "../src/middleware/express.js";

// ---------------------------------------------------------------------------
// Minimal mock of Express req/res
// ---------------------------------------------------------------------------

function makeMockRes(statusCode = 200): { res: NodeJS.EventEmitter & Record<string, unknown>; getHeaderMock: ReturnType<typeof vi.fn> } {
  const emitter = new EventEmitter() as NodeJS.EventEmitter & Record<string, unknown>;
  const getHeaderMock = vi.fn().mockReturnValue(undefined);
  emitter.statusCode = statusCode;
  emitter.getHeader = getHeaderMock;
  return { res: emitter, getHeaderMock };
}

function makeMockReq(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    method: "GET",
    path: "/api/users",
    url: "/api/users?page=1",
    headers: {
      "user-agent": "TestAgent/1.0",
      "content-length": "0",
    },
    query: { page: "1" },
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("pulseStackExpressMiddleware", () => {
  let client: PulseStackClient;
  let recordMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new PulseStackClient({ apiKey: "ps_live_test", disabled: true });
    recordMock = vi.spyOn(client, "recordHttpRequest") as unknown as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls next() immediately", () => {
    const middleware = pulseStackExpressMiddleware(client);
    const req = makeMockReq();
    const { res } = makeMockRes(200);
    const next = vi.fn();

    middleware(req as any, res as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("records HTTP request on res.finish", () => {
    const middleware = pulseStackExpressMiddleware(client);
    const req = makeMockReq();
    const { res } = makeMockRes(200);
    const next = vi.fn();

    middleware(req as any, res as any, next);

    expect(recordMock).not.toHaveBeenCalled();

    res.emit("finish");

    expect(recordMock).toHaveBeenCalledTimes(1);
    const call = recordMock.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/api/users");
    expect(call.statusCode).toBe(200);
    expect(call.durationMs).toBeGreaterThanOrEqual(0);
    expect(call.userAgent).toBe("TestAgent/1.0");
    expect(call.clientIp).toBe("127.0.0.1");
  });

  it("extracts client IP from x-forwarded-for header", () => {
    const middleware = pulseStackExpressMiddleware(client);
    const req = makeMockReq({
      headers: {
        "user-agent": "UA",
        "x-forwarded-for": "203.0.113.1, 10.0.0.1",
      },
    });
    const { res } = makeMockRes(200);
    const next = vi.fn();

    middleware(req as any, res as any, next);
    res.emit("finish");

    const call = recordMock.mock.calls[0][0];
    expect(call.clientIp).toBe("203.0.113.1");
  });

  it("records 5xx responses correctly", () => {
    const middleware = pulseStackExpressMiddleware(client);
    const req = makeMockReq({ method: "POST", path: "/api/crash", url: "/api/crash" });
    const { res } = makeMockRes(500);
    const next = vi.fn();

    middleware(req as any, res as any, next);
    res.emit("finish");

    const call = recordMock.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.statusCode).toBe(500);
    expect(call.path).toBe("/api/crash");
  });

  it("captures response content-length when present", () => {
    const middleware = pulseStackExpressMiddleware(client);
    const req = makeMockReq();
    const { res, getHeaderMock } = makeMockRes(200);
    getHeaderMock.mockReturnValue("1024");
    const next = vi.fn();

    middleware(req as any, res as any, next);
    res.emit("finish");

    const call = recordMock.mock.calls[0][0];
    expect(call.responseBodySize).toBe(1024);
  });

  it("captures query parameters from req.query", () => {
    const middleware = pulseStackExpressMiddleware(client);
    const req = makeMockReq({ query: { filter: "active", limit: "20" } });
    const { res } = makeMockRes(200);
    const next = vi.fn();

    middleware(req as any, res as any, next);
    res.emit("finish");

    const call = recordMock.mock.calls[0][0];
    expect(call.queryParams).toEqual({ filter: "active", limit: "20" });
  });
});

describe("pulseStackExpressErrorHandler", () => {
  let client: PulseStackClient;
  let captureMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new PulseStackClient({ apiKey: "ps_live_test", disabled: true });
    captureMock = vi.spyOn(client, "captureError") as unknown as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("captures Error instances as unhandled events", () => {
    const handler = pulseStackExpressErrorHandler(client);
    const err = new RangeError("out of bounds");
    const next = vi.fn();

    handler(err, {} as any, {} as any, next);

    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock.mock.calls[0][0]).toBe(err);
    expect(captureMock.mock.calls[0][1]).toEqual({ handled: false });
  });

  it("wraps non-Error values in Error before capturing", () => {
    const handler = pulseStackExpressErrorHandler(client);
    const next = vi.fn();

    handler("something went wrong", {} as any, {} as any, next);

    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock.mock.calls[0][0]).toBeInstanceOf(Error);
    expect((captureMock.mock.calls[0][0] as Error).message).toContain("something went wrong");
  });

  it("calls next() to continue Express error handling chain", () => {
    const handler = pulseStackExpressErrorHandler(client);
    const err = new Error("boom");
    const next = vi.fn();

    handler(err, {} as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
