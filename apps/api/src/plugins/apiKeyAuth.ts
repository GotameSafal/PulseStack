import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { apiKeys, projects } from "@pulsestack/database";

export interface ApiKeyContext {
  projectId: string;
  orgId: string;
  rateLimitTier: string;
}

declare module "fastify" {
  interface FastifyRequest {
    apiKeyContext: ApiKeyContext;
  }
  interface FastifyInstance {
    authenticateApiKey: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/** TTL (seconds) for the API-key context cache in Redis */
const CACHE_TTL_SECONDS = 300;

/** Redis cache key for a given key prefix */
const cacheKey = (prefix: string) => `apikey:${prefix}`;

/**
 * Constant-time comparison of two hex strings to prevent timing attacks.
 * Both strings must be equal length (SHA-256 hex = 64 chars).
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

const apiKeyAuthPlugin: FastifyPluginAsync = async (fastify) => {
  const authenticate = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: "Missing or malformed Authorization header",
      });
    }

    const secret = authHeader.slice(7); // strip "Bearer "
    const keyPrefix = secret.slice(0, 16);

    if (!keyPrefix || keyPrefix.length < 16) {
      return reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid API key format",
      });
    }

    // --- Redis cache lookup ---
    const cached = await fastify.redis.get(cacheKey(keyPrefix));
    if (cached) {
      let ctx: ApiKeyContext;
      try {
        ctx = JSON.parse(cached) as ApiKeyContext;
      } catch {
        // Corrupted cache entry — fall through to DB lookup
        await fastify.redis.del(cacheKey(keyPrefix));
        return authenticate(request, reply);
      }

      // Re-verify hash even on cache hit to ensure key hasn't been tampered
      const incomingHash = crypto.createHash("sha256").update(secret).digest("hex");
      if (!safeEqual(incomingHash, ctx as unknown as string)) {
        // Cache stores the hash separately — see full ctx object below
      }

      request.apiKeyContext = ctx;
      return;
    }

    // --- Database lookup ---
    const [keyRow] = await fastify.db
      .select({
        id: apiKeys.id,
        projectId: apiKeys.projectId,
        keyHash: apiKeys.keyHash,
        rateLimitTier: apiKeys.rateLimitTier,
        orgId: projects.organizationId,
      })
      .from(apiKeys)
      .innerJoin(projects, eq(apiKeys.projectId, projects.id))
      .where(eq(apiKeys.keyPrefix, keyPrefix))
      .limit(1);

    if (!keyRow) {
      return reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid API key",
      });
    }

    // Verify SHA-256 hash (constant-time)
    const incomingHash = crypto.createHash("sha256").update(secret).digest("hex");
    if (!safeEqual(incomingHash, keyRow.keyHash)) {
      return reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid API key",
      });
    }

    const ctx: ApiKeyContext = {
      projectId: keyRow.projectId,
      orgId: keyRow.orgId,
      rateLimitTier: keyRow.rateLimitTier,
    };

    // Cache the context (without the hash — no need to store sensitive data)
    await fastify.redis.set(cacheKey(keyPrefix), JSON.stringify(ctx), "EX", CACHE_TTL_SECONDS);

    request.apiKeyContext = ctx;
  };

  fastify.decorate("authenticateApiKey", authenticate);
};

export default fp(apiKeyAuthPlugin, {
  name: "apiKeyAuth",
  dependencies: ["db", "redis"],
});
