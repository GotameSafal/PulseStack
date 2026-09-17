import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
import authPlugin from "../src/plugins/auth";
import apiKeyAuthPlugin from "../src/plugins/apiKeyAuth";
import rateLimiterPlugin from "../src/plugins/rateLimiter";
import ingestRoutes from "../src/routes/ingest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/** Build a valid ps_live_ secret with known prefix and hash */
function makeApiKey() {
  const secret = `ps_live_${"a".repeat(48)}`; // 56-char deterministic key
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
  const zsets = new Map<string, Map<string, number>>(); // key → member → score
  const stream: StreamEntry[] = [];
  let idCounter = 0;

  return {
    // --- Used by apiKeyAuth ---
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string, _ex?: string, _ttl?: number) => {
      store.set(key, value);
      return "OK";
    },
    del: async (key: string) => {
      store.delete(key);
      return 1;
    },

    // --- Used by rateLimiter ---
    zremrangebyscore: async (key: string, _min: string | number, max: number) => {
      const zset = zsets.get(key);
      if (!zset) return 0;
      let removed = 0;
      for (const [member, score] of zset) {
        if (score <= max) {
          zset.delete(member);
          removed++;
        }
      }
      return removed;
    },
    zcard: async (key: string) => {
      return zsets.get(key)?.size ?? 0;
    },
    zadd: async (key: string, score: number, member: string) => {
      if (!zsets.has(key)) zsets.set(key, new Map());
      zsets.get(key)!.set(member, score);
      return 1;
    },
    expire: async (_key: string, _ttl: number) => 1,

    // --- Used by ingest route ---
    xadd: async (
      key: string,
      _id: string,
      ...fieldValues: string[]
    ): Promise<string> => {
      const streamId = `${Date.now()}-${idCounter++}`;
      const fields: Record<string, string> = {};
      for (let i = 0; i < fieldValues.length; i += 2) {
        fields[fieldValues[i]!] = fieldValues[i + 1]!;
      }
      stream.push({ id: streamId, fields });
      return streamId;
    },

    // --- Lifecycle ---
    quit: async () => "OK",

    // --- Test inspection helpers ---
    _store: store,
    _zsets: zsets,
    _stream: stream,

    // Allow seeding the cache
    _seedCache: (key: string, value: string) => store.set(key, value),

    // Override zcard for rate-limit testing
    _setZcard: (key: string, count: number) => {
      const m = new Map<string, number>();
      for (let i = 0; i < count; i++) m.set(String(i), Date.now() - i);
      zsets.set(key, m);
    },
  };
}

type MockRedis = ReturnType<typeof buildMockRedis>;

// ---------------------------------------------------------------------------
// Mock Drizzle DB (apiKeyAuth needs innerJoin on api_keys + projects)
// ---------------------------------------------------------------------------

function buildMockDb(
  apiKeyRows: Array<{
    id: string;
    projectId: string;
    keyPrefix: string;
    keyHash: string;
    rateLimitTier: string;
    orgId: string;
  }>
) {
  return {
    select: (_fields?: any) => ({
      from: (_table: any) => ({
        innerJoin: (_joinTable: any, _on: any) => ({
          where: (_condition: any) => ({
            limit: async (_n?: number) => {
              // Return the first matching row (single prefix per request)
              return apiKeyRows.slice(0, 1);
            },
          }),
        }),
        where: (_condition: any) => ({
          limit: async (_n?: number) => [],
        }),
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// App builder for tests (no real Redis / Postgres)
// ---------------------------------------------------------------------------

async function buildTestApp(
  mockRedis: MockRedis,
  apiKeyRows: ReturnType<typeof buildMockDb> extends { select: () => { from: () => { innerJoin: () => { where: () => { limit: infer R } } } } }
    ? never
    : Parameters<typeof buildMockDb>[0]
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(sensible);
  await app.register(cors);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie);

  // Mock DB plugin — must be named "db" to satisfy apiKeyAuth dependency declaration
  const mockDbPlugin = fp(
    async (f) => {
      f.decorate("db", buildMockDb(apiKeyRows));
    },
    { name: "db" }
  );
  await app.register(mockDbPlugin);

  // Mock Redis plugin — must be named "redis" to satisfy apiKeyAuth/rateLimiter dependency declarations
  const mockRedisPlugin = fp(
    async (f) => {
      f.decorate("redis", mockRedis);
      f.addHook("onClose", async () => {});
    },
    { name: "redis" }
  );
  await app.register(mockRedisPlugin);

  await app.register(authPlugin, {
    jwtSecret: "test-secret-that-is-at-least-32-chars-long",
  });
  await app.register(apiKeyAuthPlugin);
  await app.register(rateLimiterPlugin);
  await app.register(ingestRoutes, { prefix: "/v1" });

  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const { secret: VALID_SECRET, keyPrefix: VALID_PREFIX, keyHash: VALID_HASH } = makeApiKey();

const VALID_API_KEY_ROW = [
  {
    id: "key-1",
    projectId: "project-1",
    keyPrefix: VALID_PREFIX,
    keyHash: VALID_HASH,
    rateLimitTier: "standard",
    orgId: "org-1",
  },
];

const VALID_HTTP_EVENT = {
  type: "http_request" as const,
  id: "evt-1",
  timestamp: new Date().toISOString(),
  method: "GET" as const,
  path: "/api/users",
  statusCode: 200,
  durationMs: 42,
};

const VALID_BATCH = {
  events: [VALID_HTTP_EVENT],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /v1/ingest", () => {
  let app: FastifyInstance;
  let mockRedis: MockRedis;

  beforeAll(async () => {
    mockRedis = buildMockRedis();
    app = await buildTestApp(mockRedis, VALID_API_KEY_ROW);
  });

  afterAll(async () => {
    await app.close();
  });

  // --- Authentication ---

  it("returns 401 when Authorization header is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/ingest",
      payload: VALID_BATCH,
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when Authorization header has wrong format", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/ingest",
      headers: { authorization: "Token something" },
      payload: VALID_BATCH,
    });

    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when API key has invalid hash (tampered secret)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/ingest",
      // Same prefix but wrong secret body — hash won't match
      headers: { authorization: `Bearer ps_live_${"x".repeat(48)}` },
      payload: VALID_BATCH,
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Unauthorized");
  });

  // --- Schema validation ---

  it("returns 400 when payload body is invalid (empty events array)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/ingest",
      headers: { authorization: `Bearer ${VALID_SECRET}` },
      payload: { events: [] }, // min(1) fails
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when an event has an invalid statusCode", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/ingest",
      headers: { authorization: `Bearer ${VALID_SECRET}` },
      payload: {
        events: [
          {
            ...VALID_HTTP_EVENT,
            statusCode: 999, // max 599
          },
        ],
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when event type is unknown", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/ingest",
      headers: { authorization: `Bearer ${VALID_SECRET}` },
      payload: {
        events: [{ type: "unknown_event", id: "x", timestamp: new Date().toISOString() }],
      },
    });

    expect(res.statusCode).toBe(400);
  });

  // --- Successful ingestion ---

  it("returns 202 and accepted count for a valid single-event batch", async () => {
    const redis = buildMockRedis();
    const testApp = await buildTestApp(redis, VALID_API_KEY_ROW);

    const res = await testApp.inject({
      method: "POST",
      url: "/v1/ingest",
      headers: { authorization: `Bearer ${VALID_SECRET}` },
      payload: VALID_BATCH,
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.accepted).toBe(1);

    await testApp.close();
  });

  it("writes each event to the Redis stream with correct projectId and data fields", async () => {
    const redis = buildMockRedis();
    const testApp = await buildTestApp(redis, VALID_API_KEY_ROW);

    const events = [
      VALID_HTTP_EVENT,
      { ...VALID_HTTP_EVENT, id: "evt-2", path: "/api/products", statusCode: 201 },
    ];

    await testApp.inject({
      method: "POST",
      url: "/v1/ingest",
      headers: { authorization: `Bearer ${VALID_SECRET}` },
      payload: { events },
    });

    expect(redis._stream).toHaveLength(2);

    for (const entry of redis._stream) {
      expect(entry.fields.projectId).toBe("project-1");
      const parsed = JSON.parse(entry.fields.data!);
      expect(parsed.type).toBe("http_request");
    }

    const ids = redis._stream.map((e) => JSON.parse(e.fields.data!).id);
    expect(ids).toContain("evt-1");
    expect(ids).toContain("evt-2");

    await testApp.close();
  });

  it("uses Redis cache for subsequent requests with same API key", async () => {
    const redis = buildMockRedis();
    const testApp = await buildTestApp(redis, VALID_API_KEY_ROW);

    // First request — populates cache
    await testApp.inject({
      method: "POST",
      url: "/v1/ingest",
      headers: { authorization: `Bearer ${VALID_SECRET}` },
      payload: VALID_BATCH,
    });

    const cacheKey = `apikey:${VALID_PREFIX}`;
    expect(redis._store.has(cacheKey)).toBe(true);

    const cached = JSON.parse(redis._store.get(cacheKey)!);
    expect(cached.projectId).toBe("project-1");
    expect(cached.orgId).toBe("org-1");

    await testApp.close();
  });

  // --- Rate limiting ---

  it("returns 429 when rate limit is exceeded", async () => {
    const redis = buildMockRedis();
    const testApp = await buildTestApp(redis, VALID_API_KEY_ROW);

    // Pre-fill the sorted set to exactly the standard limit (1000)
    redis._setZcard(`ratelimit:project-1`, 1000);

    const res = await testApp.inject({
      method: "POST",
      url: "/v1/ingest",
      headers: { authorization: `Bearer ${VALID_SECRET}` },
      payload: VALID_BATCH,
    });

    expect(res.statusCode).toBe(429);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Too Many Requests");
    expect(res.headers["retry-after"]).toBeDefined();

    await testApp.close();
  });

  it("allows request when rate limit is one below the threshold", async () => {
    const redis = buildMockRedis();
    const testApp = await buildTestApp(redis, VALID_API_KEY_ROW);

    // 999 existing entries — one under the limit of 1000
    redis._setZcard(`ratelimit:project-1`, 999);

    const res = await testApp.inject({
      method: "POST",
      url: "/v1/ingest",
      headers: { authorization: `Bearer ${VALID_SECRET}` },
      payload: VALID_BATCH,
    });

    expect(res.statusCode).toBe(202);

    await testApp.close();
  });

  // --- Multi-event batch ---

  it("accepts a batch with multiple valid event types", async () => {
    const redis = buildMockRedis();
    const testApp = await buildTestApp(redis, VALID_API_KEY_ROW);

    const res = await testApp.inject({
      method: "POST",
      url: "/v1/ingest",
      headers: { authorization: `Bearer ${VALID_SECRET}` },
      payload: {
        sentAt: new Date().toISOString(),
        events: [
          VALID_HTTP_EVENT,
          {
            type: "error",
            id: "err-1",
            timestamp: new Date().toISOString(),
            name: "TypeError",
            message: "Cannot read properties of undefined",
          },
          {
            type: "database_query",
            id: "db-1",
            timestamp: new Date().toISOString(),
            query: "SELECT * FROM users",
            durationMs: 12,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(202);
    expect(JSON.parse(res.body).accepted).toBe(3);
    expect(redis._stream).toHaveLength(3);

    await testApp.close();
  });
});
