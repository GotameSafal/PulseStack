import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import sensible from "@fastify/sensible";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import fp from "fastify-plugin";
import crypto from "node:crypto";
import { PulseStackClient } from "@pulsestack/node";
import authPlugin from "../../src/plugins/auth.js";
import apiKeyAuthPlugin from "../../src/plugins/apiKeyAuth.js";
import rateLimiterPlugin from "../../src/plugins/rateLimiter.js";
import ingestRoutes from "../../src/routes/ingest.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function makeApiKey() {
  const secret = `ps_live_${"b".repeat(48)}`;
  const keyPrefix = secret.slice(0, 16);
  const keyHash = sha256(secret);
  return { secret, keyPrefix, keyHash };
}

// ---------------------------------------------------------------------------
// Mock Redis
// ---------------------------------------------------------------------------

type StreamEntry = { id: string; fields: Record<string, string> };

function buildMockRedis() {
  const store = new Map<string, string>();
  const zsets = new Map<string, Map<string, number>>();
  const stream: StreamEntry[] = [];
  let idCounter = 0;

  return {
    get: async (key: string) => store.get(key) ?? null,
    // apiKeyAuth calls: redis.set(key, value, "EX", ttl)
    set: async (key: string, value: string, ..._args: unknown[]) => {
      store.set(key, value);
      return "OK";
    },
    del: async (key: string) => {
      store.delete(key);
      return 1;
    },
    // rateLimiter: remove scores <= windowStart
    zremrangebyscore: async (key: string, _min: string | number, max: number) => {
      const zset = zsets.get(key) ?? new Map();
      let removed = 0;
      for (const [member, score] of zset.entries()) {
        if (score <= max) { zset.delete(member); removed++; }
      }
      zsets.set(key, zset);
      return removed;
    },
    zadd: async (key: string, score: number, member: string) => {
      const zset = zsets.get(key) ?? new Map();
      zset.set(member, score);
      zsets.set(key, zset);
      return 1;
    },
    zcard: async (key: string) => (zsets.get(key)?.size ?? 0),
    // rateLimiter calls expire to refresh TTL — no-op in mock
    expire: async (_key: string, _ttl: number) => 1,
    xadd: async (key: string, _id: string, ...fieldValues: string[]) => {
      const fields: Record<string, string> = {};
      for (let i = 0; i < fieldValues.length; i += 2) {
        fields[fieldValues[i]!] = fieldValues[i + 1]!;
      }
      idCounter++;
      const id = `${Date.now()}-${idCounter}`;
      stream.push({ id, fields });
      return id;
    },
    _stream: stream,
  };
}

// ---------------------------------------------------------------------------
// Build in-process API app with mocked DB and Redis
// ---------------------------------------------------------------------------

async function buildIngestApp(opts: {
  apiKeySecret: string;
  apiKeyPrefix: string;
  apiKeyHash: string;
  projectId: string;
  redis: ReturnType<typeof buildMockRedis>;
}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(sensible);
  await app.register(cors);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie);

  // Stub DB: returns the test API key row
  const mockDbPlugin = fp(
    async (f) => {
      f.decorate("db", {
        select: () => ({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: async () => [
                  {
                    id: "test-key-id",
                    projectId: opts.projectId,
                    keyHash: opts.apiKeyHash,
                    rateLimitTier: "standard",
                    orgId: "test-org-id",
                  },
                ],
              }),
            }),
          }),
        }),
      });
    },
    { name: "db" }
  );
  await app.register(mockDbPlugin);

  // Stub Redis
  const mockRedisPlugin = fp(
    async (f) => {
      f.decorate("redis", opts.redis);
    },
    { name: "redis" }
  );
  await app.register(mockRedisPlugin);

  await app.register(authPlugin, { jwtSecret: "sdk-integration-test-jwt-secret-32" });
  await app.register(apiKeyAuthPlugin);
  await app.register(rateLimiterPlugin);
  await app.register(ingestRoutes, { prefix: "/v1" });

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Plan 4.2: SDK → Ingest Integration", () => {
  const { secret: apiKeySecret, keyPrefix: apiKeyPrefix, keyHash: apiKeyHash } = makeApiKey();
  const projectId = "proj-sdk-integration-test";
  const mockRedis = buildMockRedis();

  let app: FastifyInstance;
  let fetchInterceptor: ReturnType<typeof vi.fn>;
  let originalFetch: typeof globalThis.fetch;

  beforeAll(async () => {
    app = await buildIngestApp({ apiKeySecret, apiKeyPrefix, apiKeyHash, projectId, redis: mockRedis });
    await app.ready();
    await app.listen({ port: 0, host: "127.0.0.1" });
  });

  afterAll(async () => {
    await app.close();
  });

  it("SDK flush sends a correctly structured POST to /v1/ingest", async () => {
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("App server not listening");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const client = new PulseStackClient({
      apiKey: apiKeySecret,
      endpoint: baseUrl,
      maxBatchSize: 50,
      flushIntervalMs: 60000, // manual flush only
    });

    client.recordHttpRequest({
      method: "POST",
      path: "/api/orders",
      statusCode: 201,
      durationMs: 45.7,
      clientIp: "10.0.0.1",
      userAgent: "PulseStack-SDK-Test/1.0",
    });

    client.recordHttpRequest({
      method: "GET",
      path: "/api/products",
      statusCode: 200,
      durationMs: 12.3,
    });

    expect(client.pendingEventsCount).toBe(2);

    // Flush to the in-process Fastify server (real HTTP)
    await client.flush();

    expect(client.pendingEventsCount).toBe(0);

    // Verify both events landed in the mock Redis stream
    expect(mockRedis._stream.length).toBeGreaterThanOrEqual(2);

    const streamEntries = mockRedis._stream;
    const projectEntries = streamEntries.filter((e) => e.fields.projectId === projectId);
    expect(projectEntries.length).toBeGreaterThanOrEqual(2);

    const allEventData = projectEntries
      .map((e) => JSON.parse(e.fields.data ?? "{}"))
      .filter((ev) => ["/api/orders", "/api/products"].includes(ev.path));

    expect(allEventData.length).toBe(2);

    const orderEvent = allEventData.find((ev) => ev.path === "/api/orders");
    expect(orderEvent).toBeDefined();
    expect(orderEvent.method).toBe("POST");
    expect(orderEvent.status_code ?? orderEvent.statusCode).toBe(201);
    expect(orderEvent.type).toBe("http_request");

    const productEvent = allEventData.find((ev) => ev.path === "/api/products");
    expect(productEvent).toBeDefined();
    expect(productEvent.method).toBe("GET");
    expect(productEvent.type).toBe("http_request");

    await client.close();
  });

  it("SDK captures an error event and flushes to /v1/ingest", async () => {
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("App server not listening");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const streamLengthBefore = mockRedis._stream.length;

    const client = new PulseStackClient({
      apiKey: apiKeySecret,
      endpoint: baseUrl,
      maxBatchSize: 50,
      flushIntervalMs: 60000,
    });

    const testError = new TypeError("Payment gateway timeout");
    client.captureError(testError, { handled: false, context: { orderId: "ord-001" } });

    expect(client.pendingEventsCount).toBe(1);
    await client.flush();
    expect(client.pendingEventsCount).toBe(0);

    const newEntries = mockRedis._stream.slice(streamLengthBefore);
    const projectEntries = newEntries.filter((e) => e.fields.projectId === projectId);
    expect(projectEntries.length).toBeGreaterThanOrEqual(1);

    const errorEventData = projectEntries
      .map((e) => JSON.parse(e.fields.data ?? "{}"))
      .find((ev) => ev.type === "error");

    expect(errorEventData).toBeDefined();
    expect(errorEventData.name).toBe("TypeError");
    expect(errorEventData.message).toBe("Payment gateway timeout");
    expect(errorEventData.handled).toBe(false);

    await client.close();
  });

  it("SDK rejects requests with an invalid API key (401 from ingest)", async () => {
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("App server not listening");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const errors: Error[] = [];
    const client = new PulseStackClient({
      apiKey: "ps_live_invalidkey00000000000000000000000000000000000000",
      endpoint: baseUrl,
      maxBatchSize: 50,
      flushIntervalMs: 60000,
      onError: (err) => errors.push(err),
    });

    client.recordHttpRequest({ method: "GET", path: "/check", statusCode: 200, durationMs: 5 });
    await client.flush();

    // Should have reported an auth error via onError callback
    expect(errors.length).toBeGreaterThanOrEqual(1);
    const authError = errors.find((e) => e.message.includes("authentication failed") || e.message.includes("401"));
    expect(authError).toBeDefined();

    await client.close();
  });
});
