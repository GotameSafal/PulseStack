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
import authPlugin from "../src/plugins/auth.js";
import projectAccessPlugin from "../src/plugins/projectAccess.js";
import alertRoutes from "../src/routes/alerts.js";

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

type MockAlertRule = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  metric: string;
  threshold: number;
  condition: string;
  windowMinutes: number;
  cooldownMinutes: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const mockProjects = [
  { id: "proj-1", organizationId: "org-1", name: "Test", slug: "test", environment: "development" },
];
const mockMembers = [
  { id: "mem-1", organizationId: "org-1", userId: "user-1", role: "OWNER" },
];
const mockAlertRules: MockAlertRule[] = [];

// ---------------------------------------------------------------------------
// Helper: extract values from Drizzle condition objects
// ---------------------------------------------------------------------------

function getConditionValues(condition: any): any[] {
  const vals: any[] = [];
  const extract = (item: any) => {
    if (!item) return;
    if (item.queryChunks && Array.isArray(item.queryChunks)) {
      for (const chunk of item.queryChunks) extract(chunk);
    } else if (item && typeof item === "object" && "value" in item && !Array.isArray(item.value)) {
      vals.push(item.value);
    }
  };
  extract(condition);
  return vals;
}

// ---------------------------------------------------------------------------
// Mock DB — fluent builder that always resolves to the right store
// ---------------------------------------------------------------------------

function makeMockDb() {
  // Returns a chainable object that ultimately executes `execFn`
  function chain(execFn: () => Promise<any[]>): any {
    const obj: any = {
      where: (condition: any) => {
        const vals = getConditionValues(condition);
        return chain(() => execFn().then((rows) => rows.filter((r) => {
          // Return rows that match ANY of the condition values
          return vals.some((v) =>
            Object.values(r).includes(v)
          );
        })));
      },
      orderBy: () => chain(execFn),
      limit: (n: number) => execFn().then((rows) => rows.slice(0, n)),
      then: (fn: any, rej?: any) => execFn().then(fn, rej),
    };
    return obj;
  }

  return {
    select: () => ({
      from: (table: any) => {
        const tableName = table[Symbol.for("drizzle:Name")] || "";
        let rows: any[] = [];
        if (tableName === "projects") rows = mockProjects;
        else if (tableName === "organization_members") rows = mockMembers;
        else if (tableName === "alert_rules") rows = [...mockAlertRules];
        return chain(async () => rows);
      },
    }),

    insert: (table: any) => ({
      values: (data: any) => ({
        returning: async () => {
          const tableName = table[Symbol.for("drizzle:Name")] || "";
          if (tableName === "alert_rules") {
            const rule: MockAlertRule = {
              id: `rule-${mockAlertRules.length + 1}`,
              projectId: data.projectId,
              name: data.name,
              description: data.description ?? null,
              metric: data.metric,
              threshold: data.threshold,
              condition: data.condition,
              windowMinutes: data.windowMinutes ?? 5,
              cooldownMinutes: data.cooldownMinutes ?? 15,
              enabled: data.enabled ?? true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockAlertRules.push(rule);
            return [rule];
          }
          return [data];
        },
      }),
    }),

    update: (_table: any) => ({
      set: (data: any) => ({
        where: (condition: any) => ({
          returning: async () => {
            const vals = getConditionValues(condition);
            const idx = mockAlertRules.findIndex((r) => vals.includes(r.id));
            if (idx !== -1) {
              Object.assign(mockAlertRules[idx]!, data, { updatedAt: new Date() });
              return [mockAlertRules[idx]!];
            }
            return [];
          },
        }),
      }),
    }),

    delete: (_table: any) => ({
      where: async (condition: any) => {
        const vals = getConditionValues(condition);
        const idx = mockAlertRules.findIndex((r) => vals.includes(r.id));
        if (idx !== -1) mockAlertRules.splice(idx, 1);
        return [];
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Build test app
// ---------------------------------------------------------------------------

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(sensible);
  await app.register(cors);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie);

  const dbPlugin = fp(async (f) => { f.decorate("db", makeMockDb()); }, { name: "db" });
  await app.register(dbPlugin);

  await app.register(authPlugin, { jwtSecret: "test-alert-jwt-secret-32-chars!!" });
  await app.register(projectAccessPlugin);
  await app.register(alertRoutes, { prefix: "/v1/projects" });
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Alert Rule Routes (/v1/projects/:projectId/alerts)", () => {
  let app: FastifyInstance;
  let token: string;
  let createdRuleId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    token = app.jwt.sign({ userId: "user-1", email: "u@test.com" });
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /alerts — creates an alert rule", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/projects/proj-1/alerts",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: "High Error Rate",
        metric: "error_rate",
        threshold: 5.0,
        condition: "gt",
        windowMinutes: 10,
        cooldownMinutes: 30,
        enabled: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe("High Error Rate");
    expect(body.metric).toBe("error_rate");
    expect(body.threshold).toBe(5.0);
    expect(body.condition).toBe("gt");
    expect(body.projectId).toBe("proj-1");
    expect(body.enabled).toBe(true);
    createdRuleId = body.id;
  });

  it("GET /alerts — lists alert rules for a project", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/projects/proj-1/alerts",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  it("POST /alerts — returns 400 for invalid metric enum", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/projects/proj-1/alerts",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Bad Rule", metric: "invalid_metric", threshold: 1, condition: "gt" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /alerts — returns 400 for invalid condition enum", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/projects/proj-1/alerts",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Bad Rule", metric: "error_rate", threshold: 1, condition: "eq" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /alerts — returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/projects/proj-1/alerts" });
    expect(res.statusCode).toBe(401);
  });

  it("POST /alerts — returns 404 for non-existent project", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/projects/proj-nonexistent/alerts",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Ghost Rule", metric: "error_rate", threshold: 1, condition: "gt" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE /alerts/:ruleId — deletes a rule", async () => {
    // Use the rule created in the first test
    const res = await app.inject({
      method: "DELETE",
      url: `/v1/projects/proj-1/alerts/${createdRuleId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });
});
