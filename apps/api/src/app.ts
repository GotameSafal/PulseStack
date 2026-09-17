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
import authRoutes from "./routes/auth";
import organizationRoutes from "./routes/organizations";
import projectRoutes from "./routes/projects";

export interface AppOptions extends FastifyServerOptions {
  dbOptions?: DbPluginOptions;
  authOptions?: AuthPluginOptions;
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

  // Register route groups
  await app.register(authRoutes, { prefix: "/v1/auth" });
  await app.register(organizationRoutes, { prefix: "/v1/organizations" });
  await app.register(projectRoutes, { prefix: "/v1/projects" });

  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  return app;
}
