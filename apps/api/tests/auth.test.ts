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
import authRoutes from "../src/routes/auth";
import { hashPassword } from "../src/lib/password";

describe("Auth Routes (/v1/auth)", () => {
  let app: FastifyInstance;

  // In-memory data store for isolated mock testing
  const mockUsers: Array<{
    id: string;
    email: string;
    passwordHash: string;
    name: string;
  }> = [];

  const mockOrgs: Array<{
    id: string;
    name: string;
    slug: string;
  }> = [];

  const mockMembers: Array<{
    id: string;
    organizationId: string;
    userId: string;
    role: string;
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

  const mockDbPlugin = fp(async (fastify) => {
    const mockDb: any = {
      select: (fields?: any) => ({
        from: (table: any) => ({
          where: (condition: any) => ({
            limit: async () => {
              const val = getConditionVal(condition);
              const tableName = table[Symbol.for("drizzle:Name")] || table._?.name || "";

              if (tableName === "users") {
                return mockUsers.filter((u) => {
                  if (val !== undefined) {
                    return u.email === val || u.id === val;
                  }
                  return true;
                });
              }
              if (tableName === "organizations") {
                return mockOrgs.filter((o) => {
                  if (val !== undefined) {
                    return o.slug === val || o.id === val;
                  }
                  return true;
                });
              }
              if (tableName === "organization_members") {
                return mockMembers.filter((m) => {
                  if (val !== undefined) {
                    return m.userId === val || m.organizationId === val;
                  }
                  return true;
                });
              }
              return [];
            },
          }),
          innerJoin: (joinTable: any, onCondition: any) => ({
            where: async (whereCond: any) => {
              const val = getConditionVal(whereCond);
              return mockMembers
                .filter((m) => m.userId === val)
                .map((m) => {
                  const org = mockOrgs.find((o) => o.id === m.organizationId);
                  return {
                    id: org?.id,
                    name: org?.name,
                    slug: org?.slug,
                    role: m.role,
                  };
                });
            },
          }),
        }),
      }),
      insert: (table: any) => ({
        values: (data: any) => {
          const insertAction = async () => {
            const tableName = table[Symbol.for("drizzle:Name")] || table._?.name || "";
            if (tableName === "users") {
              const id = `user-${mockUsers.length + 1}`;
              const user = { id, ...data };
              mockUsers.push(user);
              return [user];
            }
            if (tableName === "organizations") {
              const id = `org-${mockOrgs.length + 1}`;
              const org = { id, ...data };
              mockOrgs.push(org);
              return [org];
            }
            if (tableName === "organization_members") {
              const id = `member-${mockMembers.length + 1}`;
              const member = { id, ...data };
              mockMembers.push(member);
              return [member];
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
    await app.register(authRoutes, { prefix: "/v1/auth" });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should fail validation on register with invalid payload", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        name: "A",
        email: "not-an-email",
        password: "short",
        organizationName: "",
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("should successfully register a new user, organization, and owner membership", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        name: "Jane Doe",
        email: "jane@pulsestack.dev",
        password: "Password123",
        organizationName: "Jane Corp",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.name).toBe("Jane Doe");
    expect(body.email).toBe("jane@pulsestack.dev");
    expect(body.token).toBeDefined();
    expect(body.activeOrganizationId).toBeDefined();
    expect(mockUsers.length).toBe(1);
    expect(mockOrgs.length).toBe(1);
    expect(mockMembers.length).toBe(1);
    expect(mockMembers[0]?.role).toBe("OWNER");
  });

  it("should reject register with existing email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        name: "Jane Duplicate",
        email: "jane@pulsestack.dev",
        password: "Password123",
        organizationName: "Jane Second Org",
      },
    });

    expect(res.statusCode).toBe(409);
  });

  it("should reject login with wrong password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "jane@pulsestack.dev",
        password: "WrongPassword999",
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it("should successfully login with valid credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "jane@pulsestack.dev",
        password: "Password123",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.email).toBe("jane@pulsestack.dev");
    expect(body.token).toBeDefined();
  });

  it("should return 401 on /v1/auth/me without authorization header", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
    });

    expect(res.statusCode).toBe(401);
  });

  it("should return user profile and organizations on /v1/auth/me with valid Bearer token", async () => {
    // Login to get token
    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "jane@pulsestack.dev",
        password: "Password123",
      },
    });
    const { token } = JSON.parse(loginRes.body);

    const meRes = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(meRes.statusCode).toBe(200);
    const body = JSON.parse(meRes.body);
    expect(body.email).toBe("jane@pulsestack.dev");
    expect(body.organizations).toBeDefined();
    expect(body.organizations.length).toBeGreaterThanOrEqual(1);
    expect(body.organizations[0].role).toBe("OWNER");
  });
});
