import type { PulseStackClient } from "../client.js";

/**
 * Registers global Node.js process-level uncaught exception / unhandled rejection handlers.
 *
 * These handlers forward unhandled errors to the PulseStack SDK as non-handled error events.
 *
 * Usage:
 *   const { unregister } = registerUncaughtHandlers(client);
 *   // On shutdown:
 *   unregister();
 *
 * IMPORTANT: These handlers do NOT suppress the error or prevent process exit.
 * They only capture and forward the error before the default behavior continues.
 */
export function registerUncaughtHandlers(client: PulseStackClient): { unregister: () => void } {
  const onUncaughtException = (err: Error): void => {
    client.captureError(err, { handled: false });
  };

  const onUnhandledRejection = (reason: unknown): void => {
    if (reason instanceof Error) {
      client.captureError(reason, { handled: false });
    } else {
      client.captureError(
        new Error(`Unhandled Promise rejection: ${String(reason)}`),
        { handled: false }
      );
    }
  };

  process.on("uncaughtException", onUncaughtException);
  process.on("unhandledRejection", onUnhandledRejection);

  return {
    unregister(): void {
      process.off("uncaughtException", onUncaughtException);
      process.off("unhandledRejection", onUnhandledRejection);
    },
  };
}
