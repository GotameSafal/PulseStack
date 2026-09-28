import Fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import sensiblePlugin from "./plugins/sensible";
import dbPlugin, { DbPluginOptions } from "./plugins/db";
import authPlugin, { AuthPluginOptions } from "./plugins/auth";
import redisPlugin, { RedisPluginOptions } from "./plugins/redis";
import apiKeyAuthPlugin from "./plugins/apiKeyAuth";
import rateLimiterPlugin from "./plugins/rateLimiter";
import clickhousePlugin, { ClickHousePluginOptions } from "./plugins/clickhouse";
import projectAccessPlugin from "./plugins/projectAccess";
import authRoutes from "./routes/auth";
import organizationRoutes from "./routes/organizations";
import projectRoutes from "./routes/projects";
import userRoutes from "./routes/users";
import ingestRoutes from "./routes/ingest";
import analyticsRoutes from "./routes/analytics";
import alertRoutes from "./routes/alerts";
import incidentRoutes from "./routes/incidents";
import notificationChannelRoutes from "./routes/notificationChannels";

export interface AppOptions extends FastifyServerOptions {
  dbOptions?: DbPluginOptions;
  authOptions?: AuthPluginOptions;
  redisOptions?: RedisPluginOptions;
  clickhouseOptions?: ClickHousePluginOptions;
}

export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify(opts).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(sensiblePlugin);
  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });
  await app.register(cookie);

  await app.register(dbPlugin, opts.dbOptions || {});
  await app.register(authPlugin, opts.authOptions || {});
  await app.register(redisPlugin, opts.redisOptions || {});
  await app.register(clickhousePlugin, opts.clickhouseOptions || {});
  await app.register(apiKeyAuthPlugin);
  await app.register(rateLimiterPlugin);
  await app.register(projectAccessPlugin);

  // Register route groups
  await app.register(authRoutes, { prefix: "/v1/auth" });
  await app.register(organizationRoutes, { prefix: "/v1/organizations" });
  await app.register(projectRoutes, { prefix: "/v1/projects" });
  await app.register(userRoutes, { prefix: "/v1/users" });
  await app.register(ingestRoutes, { prefix: "/v1" });
  await app.register(analyticsRoutes, { prefix: "/v1/projects" });
  await app.register(alertRoutes, { prefix: "/v1/projects" });
  await app.register(incidentRoutes, { prefix: "/v1/projects" });
  await app.register(notificationChannelRoutes, { prefix: "/v1/projects" });

  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  return app;
}
