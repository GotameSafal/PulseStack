import { PulseStackClient } from "./client.js";
import type {
  PulseStackConfig,
  HttpRequestInput,
  ErrorInput,
  CustomEventInput,
  TelemetryEvent,
  HttpRequestEvent,
  ErrorEvent,
  DatabaseQueryEvent,
  BackgroundJobEvent,
  CustomEvent,
} from "./types.js";

let globalClient: PulseStackClient | null = null;

/**
 * Initializes the global PulseStack SDK singleton.
 */
export function init(config: PulseStackConfig): PulseStackClient {
  globalClient = new PulseStackClient(config);
  return globalClient;
}

/**
 * Returns the active PulseStack client instance, or null if not initialized.
 */
export function getClient(): PulseStackClient | null {
  return globalClient;
}

/**
 * Records an HTTP request using the global singleton client.
 */
export function recordHttpRequest(input: HttpRequestInput): void {
  if (globalClient) {
    globalClient.recordHttpRequest(input);
  }
}

/**
 * Captures an error using the global singleton client.
 */
export function captureError(
  err: Error | string | ErrorInput,
  options?: { handled?: boolean; context?: Record<string, unknown> }
): void {
  if (globalClient) {
    globalClient.captureError(err, options);
  }
}

/**
 * Captures a custom event using the global singleton client.
 */
export function captureEvent(
  nameOrInput: string | CustomEventInput,
  payload?: Record<string, unknown>
): void {
  if (globalClient) {
    globalClient.captureEvent(nameOrInput, payload);
  }
}

/**
 * Flushes all queued events using the global singleton client.
 */
export async function flush(): Promise<void> {
  if (globalClient) {
    await globalClient.flush();
  }
}

/**
 * Closes and drains the global singleton client.
 */
export async function close(timeoutMs = 3000): Promise<void> {
  if (globalClient) {
    await globalClient.close(timeoutMs);
    globalClient = null;
  }
}

// ---------------------------------------------------------------------------
// Framework Middleware & Integrations
// ---------------------------------------------------------------------------

export {
  pulseStackExpressMiddleware,
  pulseStackExpressErrorHandler,
} from "./middleware/express.js";

export { pulseStackFastifyPlugin } from "./middleware/fastify.js";
export type { PulseStackFastifyOptions } from "./middleware/fastify.js";

export { registerUncaughtHandlers } from "./integrations/uncaught.js";

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { PulseStackClient };
export type {
  PulseStackConfig,
  HttpRequestInput,
  ErrorInput,
  CustomEventInput,
  TelemetryEvent,
  HttpRequestEvent,
  ErrorEvent,
  DatabaseQueryEvent,
  BackgroundJobEvent,
  CustomEvent,
};
