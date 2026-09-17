import fp from "fastify-plugin";
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import type { PulseStackClient } from "../client.js";
import type { HttpMethod } from "../types.js";

export interface PulseStackFastifyOptions {
  /** The initialized PulseStackClient instance to use for telemetry capture. */
  client: PulseStackClient;
}

/**
 * Fastify plugin that automatically records HTTP request telemetry and captures route errors.
 *
 * Usage:
 *   await app.register(pulseStackFastifyPlugin, { client });
 */
const pulseStackFastifyPluginImpl: FastifyPluginAsync<PulseStackFastifyOptions> = async (
  fastify: FastifyInstance,
  options: PulseStackFastifyOptions
) => {
  const { client } = options;

  // Use a WeakMap to safely associate start times with request objects.
  const startTimes = new WeakMap<FastifyRequest, number>();

  fastify.addHook("onRequest", async (request: FastifyRequest) => {
    startTimes.set(request, Date.now());
  });

  fastify.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const startedAt = startTimes.get(request) ?? Date.now();
    const durationMs = Date.now() - startedAt;

    client.recordHttpRequest({
      method: request.method as HttpMethod,
      path: request.url || "/",
      statusCode: reply.statusCode,
      durationMs,
      clientIp: extractClientIp(request),
      userAgent: request.headers["user-agent"],
      headers: flattenHeaders(request.headers),
      queryParams: flattenQuery(request.query),
      requestBodySize: parseContentLength(request.headers["content-length"]),
      responseBodySize: parseContentLength(reply.getHeader("content-length")),
    });
  });

  fastify.addHook("onError", async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
    client.captureError(error, { handled: false });
    // Note: we do NOT swallow the error — Fastify's normal error handling continues.
  });
};

export const pulseStackFastifyPlugin = fp(pulseStackFastifyPluginImpl, {
  name: "pulsestack-fastify",
  fastify: ">=4.0.0",
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function extractClientIp(request: FastifyRequest): string | undefined {
  const xForwardedFor = request.headers["x-forwarded-for"];
  if (typeof xForwardedFor === "string") {
    return xForwardedFor.split(",")[0]?.trim();
  }
  return request.socket?.remoteAddress;
}

function flattenHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string> | undefined {
  const result: Record<string, string> = {};
  let hasEntries = false;
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      result[key] = Array.isArray(value) ? value.join(", ") : value;
      hasEntries = true;
    }
  }
  return hasEntries ? result : undefined;
}

function flattenQuery(query: unknown): Record<string, string> | undefined {
  if (!query || typeof query !== "object" || Array.isArray(query)) return undefined;
  const result: Record<string, string> = {};
  let hasEntries = false;
  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (value !== undefined) {
      result[key] = String(value);
      hasEntries = true;
    }
  }
  return hasEntries ? result : undefined;
}

function parseContentLength(header: unknown): number | undefined {
  if (typeof header === "string") {
    const n = parseInt(header, 10);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }
  if (typeof header === "number" && Number.isFinite(header) && header >= 0) {
    return header;
  }
  return undefined;
}
