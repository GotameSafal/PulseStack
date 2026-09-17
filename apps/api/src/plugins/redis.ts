import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import Redis from "ioredis";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

export interface RedisPluginOptions {
  redisUrl?: string;
}

const redisPlugin: FastifyPluginAsync<RedisPluginOptions> = async (fastify, opts) => {
  const url = opts.redisUrl ?? process.env.REDIS_URL ?? "redis://localhost:6379";

  const redis = new Redis(url, {
    // Fail fast on connection errors during startup rather than silently retrying forever
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  await redis.connect();

  fastify.decorate("redis", redis);

  fastify.addHook("onClose", async () => {
    await redis.quit();
  });
};

export default fp(redisPlugin, {
  name: "redis",
});
