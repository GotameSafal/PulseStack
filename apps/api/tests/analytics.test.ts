import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
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
import authPlugin from "../src/plugins/auth";
import projectAccessPlugin from "../src/plugins/projectAccess";
import analyticsRoutes from "../src/routes/analytics";

// ---------------------------------------------------------------------------
// vi.mock for @pulsestack/clickhouse query functions
// NOTE: vi.mock is hoisted before any variable declarations by Vitest's
//       transform, so the factory MUST use only inline literals.
// ---------------------------------------------------------------------------

vi.mock("@pulsestack/clickhouse", () => ({
  createClickHouseClient: vi.fn(),
  queryOverviewMetrics: vi.fn().mockResolvedValue({
    projectId: "11111111-1111-1111-1111-111111111111",
    from: "2024-01-01T00:00:00.000Z",
    to: "2024-01-01T01:00:00.000Z",
    totalRequests: 42,
    errorRequests: 3,
    errorRate: 7.14,
    throughputPerSecond: 0.01,
    p50LatencyMs: 120,
    p90LatencyMs: 300,
    p95LatencyMs: 450,
    p99LatencyMs: 900,
    statusBreakdown: { status2xx: 39, status3xx: 0, status4xx: 2, status5xx: 1 },
  }),
  queryTimeSeriesMetrics: vi.fn().mockResolvedValue({
    projectId: "11111111-1111-1111-1111-111111111111",
    from: "2024-01-01T00:00:00.000Z",
    to: "2024-01-01T01:00:00.000Z",
    intervalMinutes: 30,
    buckets: [],
  }),
  queryRequestExplorerLogs: vi.fn().mockResolvedValue({
    items: [],
    totalCount: 0,
    limit: 50,
    offset: 0,
  }),
  queryErrorGroups: vi.fn().mockResolvedValue({
    groups: [],
    totalErrors: 0,
    uniqueGroups: 0,
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const PROJECT_ORG_ID = "org-1";
const MEMBER_USER_ID = "user-member";
const OUTSIDER_USER_ID = "user-outsider";

// ---------------------------------------------------------------------------
// Mock DB plugin (mirrors pattern from projects.test.ts)
// ---------------------------------------------------------------------------

function buildMockDbPlugin(
  projects: Array<{ id: string; organizationId: string }>,
  members: Array<{ organizationId: string; userId: string }>
) {
  return fp(async (fastify) => {
    const mockDb: any = {
      select: () => ({
        from: (table: any) => ({
          where: (condition: any) => {
            const tableName =
              table[Symbol.for("drizzle:Name")] || table._?.name || "";

            const extractValues = (cond: any): any[] => {
              const vals: any[] = [];
              const walk = (item: any) => {
                if (!item) return;
                if (Array.isArray(item.queryChunks)) {
                  item.queryChunks.forEach(walk);
                } else if (
                  item &&
                  typeof item === "object" &&
                  "value" in item &&
                  !Array.isArray(item.value)
                ) {
                  vals.push(item.value);
                }
              };
              walk(cond);
              return vals;
            };

            const limit = (n: number) => {
              const vals = extractValues(condition);
              if (tableName === "projects") {
                return Promise.resolve(
                  projects.filter((p) => vals.includes(p.id)).slice(0, n)
                );
              }
              if (tableName === "organization_members") {
                return Promise.resolve(
                  members
                    .filter(
                      (m) =>
                        vals.includes(m.organizationId) &&
                        vals.includes(m.userId)
                    )
                    .slice(0, n)
                );
              }
              return Promise.resolve([]);
            };

            return { limit };
          },
        }),
      }),
    };

    fastify.decorate("db", mockDb);
  });
}

// ---------------------------------------------------------------------------
// Mock ClickHouse plugin — decorates fastify.clickhouse with a stub client
// (The actual query functions are mocked at the module level above)
// ---------------------------------------------------------------------------

const mockClickHousePlugin = fp(async (fastify) => {
  const mockClient: any = { close: async () => {} };
  fastify.decorate("clickhouse", mockClient);
});

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("Analytics Routes (/v1/projects/:projectId/analytics)", () => {
  let app: FastifyInstance;
  let memberToken: string;
  let outsiderToken: string;

  const mockProjects = [{ id: PROJECT_ID, organizationId: PROJECT_ORG_ID }];
  const mockMembers = [{ organizationId: PROJECT_ORG_ID, userId: MEMBER_USER_ID }];

  beforeAll(async () => {
    app = Fastify().withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    await app.register(sensible);
    await app.register(cors);
    await app.register(helmet, { contentSecurityPolicy: false });
    await app.register(cookie);
    await app.register(buildMockDbPlugin(mockProjects, mockMembers));
    await app.register(authPlugin, {
      jwtSecret: "test-secret-that-is-at-least-32-chars-long",
    });
    await app.register(mockClickHousePlugin);
    await app.register(projectAccessPlugin);
    await app.register(analyticsRoutes, { prefix: "/v1/projects" });

    await app.ready();

    memberToken = app.jwt.sign({
      userId: MEMBER_USER_ID,
      email: "member@example.com",
    });
    outsiderToken = app.jwt.sign({
      userId: OUTSIDER_USER_ID,
      email: "outsider@example.com",
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // -------------------------------------------------------------------------
  // Authentication guard — 401 on all endpoints
  // -------------------------------------------------------------------------

  it("GET /overview — 401 when no token provided", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/projects/${PROJECT_ID}/analytics/overview`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /timeseries — 401 when no token provided", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/projects/${PROJECT_ID}/analytics/timeseries`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /requests — 401 when no token provided", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/projects/${PROJECT_ID}/analytics/requests`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /errors — 401 when no token provided", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/projects/${PROJECT_ID}/analytics/errors`,
    });
    expect(res.statusCode).toBe(401);
  });

  // -------------------------------------------------------------------------
  // Authorization — tenant isolation
  // -------------------------------------------------------------------------

  it("GET /overview — 403 when user is not a member of the project's org", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/projects/${PROJECT_ID}/analytics/overview`,
      headers: { authorization: `Bearer ${outsiderToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("GET /overview — 404 when project does not exist", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/projects/00000000-0000-0000-0000-000000000000/analytics/overview`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  // -------------------------------------------------------------------------
  // Input validation — 400
  // -------------------------------------------------------------------------

  it("GET /overview — 400 when projectId is not a UUID", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/projects/not-a-uuid/analytics/overview`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /requests — 400 when limit exceeds max (200)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/projects/${PROJECT_ID}/analytics/requests?limit=999`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  // -------------------------------------------------------------------------
  // 200 happy-path: all four endpoints
  // -------------------------------------------------------------------------

  it("GET /overview — 200 with analytics overview for member (preset=1h)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/projects/${PROJECT_ID}/analytics/overview?preset=1h`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      projectId: PROJECT_ID,
      totalRequests: 42,
      errorRequests: 3,
      errorRate: 7.14,
      statusBreakdown: expect.objectContaining({ status2xx: 39 }),
    });
  });

  it("GET /timeseries — 200 with time-series data for member (preset=24h)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/projects/${PROJECT_ID}/analytics/timeseries?preset=24h`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      projectId: PROJECT_ID,
      intervalMinutes: expect.any(Number),
      buckets: expect.any(Array),
    });
  });

  it("GET /requests — 200 with request explorer data for member (preset=1h, limit=10)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/projects/${PROJECT_ID}/analytics/requests?preset=1h&limit=10`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ items: [], totalCount: 0, limit: 50, offset: 0 });
  });

  it("GET /errors — 200 with error groups for member (preset=7d)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/projects/${PROJECT_ID}/analytics/errors?preset=7d`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ groups: [], totalErrors: 0, uniqueGroups: 0 });
  });

  // -------------------------------------------------------------------------
  // Explicit from/to instead of preset
  // -------------------------------------------------------------------------

  it("GET /overview — 200 with explicit from/to time range", async () => {
    const to = "2024-06-01T12:00:00.000Z";
    const from = "2024-06-01T06:00:00.000Z";
    const res = await app.inject({
      method: "GET",
      url: `/v1/projects/${PROJECT_ID}/analytics/overview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().projectId).toBe(PROJECT_ID);
  });
});
