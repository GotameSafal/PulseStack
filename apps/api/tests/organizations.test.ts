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
import organizationRoutes from "../src/routes/organizations";

describe("Organization Routes (/v1/organizations)", () => {
  let app: FastifyInstance;
  let authToken: string;

  const mockOrgs: Array<{
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  const mockMembers: Array<{
    id: string;
    organizationId: string;
    userId: string;
    role: string;
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

  const mockDbPlugin = fp(async (fastify) => {
    const mockDb: any = {
      select: (fields?: any) => ({
        from: (table: any) => ({
          where: (condition: any) => ({
            limit: async () => {
              const val = getConditionVal(condition);
              const tableName = table[Symbol.for("drizzle:Name")] || table._?.name || "";

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
                    createdAt: org?.createdAt || new Date(),
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
            if (tableName === "organizations") {
              const id = `org-${mockOrgs.length + 1}`;
              const org = {
                id,
                name: data.name,
                slug: data.slug,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              mockOrgs.push(org);
              return [org];
            }
            if (tableName === "organization_members") {
              const id = `member-${mockMembers.length + 1}`;
              const member = {
                id,
                organizationId: data.organizationId,
                userId: data.userId,
                role: data.role,
                createdAt: new Date(),
              };
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
    await app.register(organizationRoutes, { prefix: "/v1/organizations" });

    await app.ready();

    authToken = app.jwt.sign({
      userId: "user-1",
      email: "test@pulsestack.dev",
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return 401 when creating organization without token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/organizations",
      payload: {
        name: "Acme Inc",
        slug: "acme-inc",
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it("should create organization and set creator as OWNER", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/organizations",
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        name: "Acme Inc",
        slug: "acme-inc",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.name).toBe("Acme Inc");
    expect(body.slug).toBe("acme-inc");
    expect(body.role).toBe("OWNER");
    expect(mockOrgs.length).toBe(1);
    expect(mockMembers.length).toBe(1);
    expect(mockMembers[0]?.role).toBe("OWNER");
  });

  it("should reject creating organization with duplicate slug", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/organizations",
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        name: "Acme Duplicate",
        slug: "acme-inc",
      },
    });

    expect(res.statusCode).toBe(409);
  });

  it("should list all organizations where user is a member", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/organizations",
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0]?.slug).toBe("acme-inc");
    expect(body[0]?.role).toBe("OWNER");
  });
});
