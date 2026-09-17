import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { Database, createDbClient } from "@pulsestack/database";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}

export interface DbPluginOptions {
  databaseUrl?: string;
}

const dbPlugin: FastifyPluginAsync<DbPluginOptions> = async (fastify, opts) => {
  const db = createDbClient({
    connectionString: opts.databaseUrl || process.env.DATABASE_URL,
  });

  fastify.decorate("db", db);
};

export default fp(dbPlugin, {
  name: "db",
});
