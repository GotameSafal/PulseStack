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
import authPlugin from "../src/plugins/auth";
import projectRoutes from "../src/routes/projects";

describe("Project and API Key Routes (/v1/projects)", () => {
  let app: FastifyInstance;
  let user1Token: string;
  let user2Token: string;

  const mockOrgs: Array<{ id: string; name: string; slug: string }> = [
    { id: "org-1", name: "Org One", slug: "org-one" },
  ];

  const mockMembers: Array<{
    id: string;
    organizationId: string;
    userId: string;
    role: string;
  }> = [{ id: "mem-1", organizationId: "org-1", userId: "user-1", role: "OWNER" }];

  const mockProjects: Array<{
    id: string;
    organizationId: string;
    name: string;
    slug: string;
    environment: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  const mockApiKeys: Array<{
    id: string;
    projectId: string;
    name: string;
    keyPrefix: string;
    keyHash: string;
    rateLimitTier: string;
    lastUsedAt: Date | null;
    createdAt: Date;
  }> = [];

  const getConditionVal = (condition: any): any => {
    if (!condition) return undefined;
    if (condition.queryChunks) {
      for (const chunk of condition.queryChunks) {
        if (chunk && typeof chunk === "object" && "value" in chunk && !Array.isArray(chunk.value)) {
          return chunk.value;
        }
      }
    }
    return condition.val;
  };

  const getConditionValues = (condition: any): any[] => {
    const vals: any[] = [];
    const extract = (item: any) => {
      if (!item) return;
      if (item.queryChunks && Array.isArray(item.queryChunks)) {
        for (const chunk of item.queryChunks) {
          extract(chunk);
        }
      } else if (item && typeof item === "object" && "value" in item && !Array.isArray(item.value)) {
        vals.push(item.value);
      }
    };
    extract(condition);
    return vals;
  };

  const mockDbPlugin = fp(async (fastify) => {
    const mockDb: any = {
      select: (fields?: any) => ({
        from: (table: any) => ({
          where: (condition: any) => {
            const executeQuery = async () => {
              const vals = getConditionValues(condition);
              const tableName = table[Symbol.for("drizzle:Name")] || table._?.name || "";

              if (tableName === "organization_members") {
                return mockMembers.filter((m) => {
                  if (vals.length >= 2) {
                    return (
                      (m.organizationId === vals[0] && m.userId === vals[1]) ||
                      (m.organizationId === vals[1] && m.userId === vals[0])
                    );
                  }
                  if (vals.length === 1) {
                    return m.userId === vals[0] || m.organizationId === vals[0];
                  }
                  return true;
                });
              }

              if (tableName === "projects") {
                return mockProjects.filter((p) => {
                  if (vals.length >= 2) {
                    return (
                      (p.organizationId === vals[0] && p.slug === vals[1]) ||
                      (p.organizationId === vals[1] && p.slug === vals[0])
                    );
                  }
                  if (vals.length === 1) {
                    return p.id === vals[0] || p.organizationId === vals[0] || p.slug === vals[0];
                  }
                  return true;
                });
              }

              if (tableName === "api_keys") {
                return mockApiKeys.filter((k) => {
                  if (vals.length >= 2) {
                    return (
                      (k.id === vals[0] && k.projectId === vals[1]) ||
                      (k.id === vals[1] && k.projectId === vals[0])
                    );
                  }
                  if (vals.length === 1) {
                    return k.id === vals[0] || k.projectId === vals[0];
                  }
                  return true;
                });
              }

              return [];
            };

            return {
              limit: executeQuery,
              then: (onfulfilled?: any, onrejected?: any) =>
                executeQuery().then(onfulfilled, onrejected),
            };
          },
        }),
      }),
      insert: (table: any) => ({
        values: (data: any) => {
          const insertAction = async () => {
            const tableName = table[Symbol.for("drizzle:Name")] || table._?.name || "";
            if (tableName === "projects") {
              const id = `project-${mockProjects.length + 1}`;
              const proj = {
                id,
                organizationId: data.organizationId,
                name: data.name,
                slug: data.slug,
                environment: data.environment || "development",
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              mockProjects.push(proj);
              return [proj];
            }
            if (tableName === "api_keys") {
              const id = `key-${mockApiKeys.length + 1}`;
              const key = {
                id,
                projectId: data.projectId,
                name: data.name,
                keyPrefix: data.keyPrefix,
                keyHash: data.keyHash,
                rateLimitTier: data.rateLimitTier || "standard",
                lastUsedAt: null,
                createdAt: new Date(),
              };
              mockApiKeys.push(key);
              return [key];
            }
            return [data];
          };

          return {
            then: (onfulfilled?: any, onrejected?: any) =>
              insertAction().then(onfulfilled, onrejected),
            returning: insertAction,
          };
        },
      }),
      delete: (table: any) => ({
        where: (condition: any) => ({
          then: async (onfulfilled?: any, onrejected?: any) => {
            const vals = getConditionValues(condition);
            const keyId = vals[0];
            const idx = mockApiKeys.findIndex((k) => k.id === keyId);
            if (idx !== -1) {
              mockApiKeys.splice(idx, 1);
            }
            return Promise.resolve({ rowCount: 1 }).then(onfulfilled, onrejected);
          },
        }),
      }),
    };

    fastify.decorate("db", mockDb);
  });

  beforeAll(async () => {
    app = Fastify().withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    await app.register(sensible);
    await app.register(cors);
    await app.register(helmet, { contentSecurityPolicy: false });
    await app.register(cookie);
    await app.register(mockDbPlugin);
    await app.register(authPlugin, { jwtSecret: "test-secret-that-is-at-least-32-chars-long" });
    await app.register(projectRoutes, { prefix: "/v1/projects" });

    await app.ready();

    user1Token = app.jwt.sign({ userId: "user-1", email: "user1@pulsestack.dev" });
    user2Token = app.jwt.sign({ userId: "user-2", email: "user2@pulsestack.dev" });
  });

  afterAll(async () => {
    await app.close();
  });

  it("should deny project creation if user is not member of org", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/projects",
      headers: {
        authorization: `Bearer ${user2Token}`,
      },
      payload: {
        organizationId: "org-1",
        name: "Backend Service",
        slug: "backend-service",
        environment: "development",
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it("should create project under organization", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/projects",
      headers: {
        authorization: `Bearer ${user1Token}`,
      },
      payload: {
        organizationId: "org-1",
        name: "Backend Service",
        slug: "backend-service",
        environment: "development",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.name).toBe("Backend Service");
    expect(body.slug).toBe("backend-service");
    expect(body.organizationId).toBe("org-1");
    expect(mockProjects.length).toBe(1);
  });

  it("should reject project creation with duplicate slug within same organization", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/projects",
      headers: {
        authorization: `Bearer ${user1Token}`,
      },
      payload: {
        organizationId: "org-1",
        name: "Backend Service Duplicate",
        slug: "backend-service",
        environment: "production",
      },
    });

    expect(res.statusCode).toBe(409);
  });

  it("should list projects for organization", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/projects?organizationId=org-1",
      headers: {
        authorization: `Bearer ${user1Token}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0]?.slug).toBe("backend-service");
  });

  it("should generate API key for project with ps_live_ prefix", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/projects/project-1/api-keys",
      headers: {
        authorization: `Bearer ${user1Token}`,
      },
      payload: {
        name: "Production Ingestion Key",
        rateLimitTier: "pro",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.name).toBe("Production Ingestion Key");
    expect(body.rateLimitTier).toBe("pro");
    expect(body.secretKey).toBeDefined();
    expect(body.secretKey.startsWith("ps_live_")).toBe(true);
    expect(body.keyPrefix).toBe(body.secretKey.slice(0, 16));
    expect(mockApiKeys.length).toBe(1);
  });

  it("should revoke API key", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/projects/project-1/api-keys/key-1",
      headers: {
        authorization: `Bearer ${user1Token}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(mockApiKeys.length).toBe(0);
  });
});
