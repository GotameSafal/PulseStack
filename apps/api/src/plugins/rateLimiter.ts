import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

/** Events allowed per 60-second window, per project, by tier */
const RATE_LIMITS: Record<string, number> = {
  standard: 1_000,
  pro: 10_000,
  enterprise: 100_000,
};

const WINDOW_SECONDS = 60;

declare module "fastify" {
  interface FastifyInstance {
    checkRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const rateLimiterPlugin: FastifyPluginAsync = async (fastify) => {
  const checkRateLimit = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const { projectId, rateLimitTier } = request.apiKeyContext;
    const limit = RATE_LIMITS[rateLimitTier] ?? RATE_LIMITS.standard;
    const key = `ratelimit:${projectId}`;
    const now = Date.now();
    const windowStart = now - WINDOW_SECONDS * 1000;

    // Sliding window using a sorted set:
    // 1. Remove entries older than the window
    // 2. Count remaining entries
    // 3. If under limit, add this request's timestamp; refresh TTL
    await fastify.redis.zremrangebyscore(key, "-inf", windowStart);
    const current = await fastify.redis.zcard(key);

    if (current >= limit) {
      reply.header("Retry-After", String(WINDOW_SECONDS));
      return reply.status(429).send({
        statusCode: 429,
        error: "Too Many Requests",
        message: `Rate limit exceeded. Allowed ${limit} events per ${WINDOW_SECONDS}s for tier '${rateLimitTier}'.`,
      });
    }

    // Add current request (score = timestamp, member = unique request identifier)
    await fastify.redis.zadd(key, now, `${now}-${Math.random()}`);
    await fastify.redis.expire(key, WINDOW_SECONDS * 2); // keep TTL generous
  };

  fastify.decorate("checkRateLimit", checkRateLimit);
};

export default fp(rateLimiterPlugin, {
  name: "rateLimiter",
  dependencies: ["redis", "apiKeyAuth"],
});
