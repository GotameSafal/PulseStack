import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from "express";
import type { PulseStackClient } from "../client.js";
import type { HttpMethod } from "../types.js";

/**
 * Express middleware that automatically records HTTP request telemetry.
 *
 * Usage:
 *   app.use(pulseStackExpressMiddleware(client));
 */
export function pulseStackExpressMiddleware(client: PulseStackClient): RequestHandler {
  return function pulseStackRequestMiddleware(req: Request, res: Response, next: NextFunction): void {
    const startedAt = Date.now();

    res.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      const path = req.path || req.url || "/";

      client.recordHttpRequest({
        method: req.method as HttpMethod,
        path,
        statusCode: res.statusCode,
        durationMs,
        clientIp: extractClientIp(req),
        userAgent: req.headers["user-agent"],
        headers: flattenHeaders(req.headers),
        queryParams: flattenQuery(req.query),
        requestBodySize: parseContentLength(req.headers["content-length"]),
        responseBodySize: parseContentLength(res.getHeader("content-length")),
      });
    });

    next();
  };
}

/**
 * Express error-handler middleware that captures unhandled errors as non-handled telemetry events.
 * Must be registered AFTER all route handlers (standard Express error handler position).
 *
 * Usage:
 *   app.use(pulseStackExpressErrorHandler(client));
 */
export function pulseStackExpressErrorHandler(client: PulseStackClient): ErrorRequestHandler {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return function pulseStackErrorMiddleware(err: unknown, _req: Request, _res: Response, next: NextFunction): void {
    if (err instanceof Error) {
      client.captureError(err, { handled: false });
    } else {
      client.captureError(new Error(String(err)), { handled: false });
    }
    next(err);
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function extractClientIp(req: Request): string | undefined {
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (typeof xForwardedFor === "string") {
    return xForwardedFor.split(",")[0]?.trim();
  }
  return req.socket?.remoteAddress;
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

function flattenQuery(
  query: Record<string, unknown>
): Record<string, string> | undefined {
  const result: Record<string, string> = {};
  let hasEntries = false;
  for (const [key, value] of Object.entries(query)) {
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
