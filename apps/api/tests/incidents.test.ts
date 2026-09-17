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
import incidentRoutes from "../src/routes/incidents.js";

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

type MockIncident = {
  id: string;
  projectId: string;
  alertRuleId: string;
  status: string;
  title: string;
  triggerValue: number;
  notes: string | null;
  openedAt: Date;
  resolvedAt: Date | null;
};

const mockProjects = [
  { id: "proj-1", organizationId: "org-1", name: "Test Project" },
];
const mockMembers = [
  { id: "mem-1", organizationId: "org-1", userId: "user-1", role: "OWNER" },
];

let mockIncidents: MockIncident[] = [
  {
    id: "inc-1",
    projectId: "proj-1",
    alertRuleId: "rule-1",
    status: "open",
    title: "High Error Rate",
    triggerValue: 8.5,
    notes: null,
    openedAt: new Date("2026-09-17T10:00:00Z"),
    resolvedAt: null,
  },
  {
    id: "inc-2",
    projectId: "proj-1",
    alertRuleId: "rule-1",
    status: "resolved",
    title: "High Latency",
    triggerValue: 1200,
    notes: "Fixed by deploy",
    openedAt: new Date("2026-09-16T08:00:00Z"),
    resolvedAt: new Date("2026-09-16T09:00:00Z"),
  },
];

// ---------------------------------------------------------------------------
// Drizzle condition extraction helper
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
// Mock DB plugin
// ---------------------------------------------------------------------------

const mockDbPlugin = fp(async (fastify) => {
  const mockDb: any = {
    select: () => ({
      from: (table: any) => ({
        where: (condition: any) => {
          const vals = getConditionValues(condition);
          const tableName = table[Symbol.for("drizzle:Name")] || "";
          const executeQuery = async () => {
            if (tableName === "projects") return mockProjects.filter((p) => vals.includes(p.id));
            if (tableName === "organization_members") {
              return mockMembers.filter((m) => vals.includes(m.organizationId) || vals.includes(m.userId));
            }
            if (tableName === "incidents") {
              return mockIncidents.filter((i) =>
                vals.every((v) => i.id === v || i.projectId === v || i.status === v)
              );
            }
            return [];
          };
          return {
            limit: executeQuery,
            orderBy: () => ({
              limit: (n: number) =>
                executeQuery().then((rows) => rows.slice(0, n)),
            }),
          };
        },
        orderBy: () => ({
          limit: (n: number) => Promise.resolve(mockIncidents.slice(0, n)),
        }),
      }),
    }),
    update: (_table: any) => ({
      set: (data: any) => ({
        where: (_condition: any) => ({
          returning: async () => {
            const idx = mockIncidents.findIndex((i) => i.id === "inc-1");
            if (idx !== -1) {
              Object.assign(mockIncidents[idx]!, data);
              return [mockIncidents[idx]!];
            }
            return [];
          },
        }),
      }),
    }),
  };
  fastify.decorate("db", mockDb);
}, { name: "db" });

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
  await app.register(mockDbPlugin);
  await app.register(authPlugin, { jwtSecret: "test-incident-jwt-secret-32chars!" });
  await app.register(projectAccessPlugin);
  await app.register(incidentRoutes, { prefix: "/v1/projects" });
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Incident Routes (/v1/projects/:projectId/incidents)", () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    token = app.jwt.sign({ userId: "user-1", email: "u@test.com" });
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /incidents — lists all incidents for a project", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/projects/proj-1/incidents",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /incidents — filters by status=open", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/projects/proj-1/incidents?status=open",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    // All returned incidents should be open
    body.forEach((i: any) => expect(i.status).toBe("open"));
  });

  it("GET /incidents/:incidentId — retrieves a single incident", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/projects/proj-1/incidents/inc-1",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe("inc-1");
    expect(body.status).toBe("open");
    expect(body.title).toBe("High Error Rate");
    expect(body.triggerValue).toBe(8.5);
  });

  it("GET /incidents/:incidentId — returns 404 for unknown incident", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/projects/proj-1/incidents/00000000-0000-0000-0000-000000000000",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("PATCH /incidents/:incidentId — updates notes on an incident", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/v1/projects/proj-1/incidents/inc-1",
      headers: { authorization: `Bearer ${token}` },
      payload: { notes: "Investigating database timeout" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.notes).toBe("Investigating database timeout");
  });

  it("PATCH /incidents/:incidentId — resolves an incident", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/v1/projects/proj-1/incidents/inc-1",
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "resolved" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("resolved");
  });

  it("GET /incidents — returns 401 without token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/projects/proj-1/incidents",
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /incidents — returns 404 for non-existent project", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/projects/proj-nonexistent/incidents",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
