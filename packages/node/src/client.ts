import type {
  PulseStackConfig,
  HttpRequestInput,
  ErrorInput,
  CustomEventInput,
  TelemetryEvent,
  HttpRequestEvent,
  ErrorEvent,
  CustomEvent,
} from "./types.js";
import { BoundedQueue, generateEventId, formatTimestamp } from "./queue.js";
import { TelemetryFlusher } from "./flusher.js";

export class PulseStackClient {
  private readonly config: Required<
    Omit<PulseStackConfig, "onError" | "disabled">
  > & { onError?: (err: Error) => void; disabled: boolean };

  private readonly queue: BoundedQueue;
  private readonly flusher: TelemetryFlusher;
  private timer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private isClosed = false;
  private closePromise: Promise<void> | null = null;

  constructor(config: PulseStackConfig) {
    if (!config.apiKey && !config.disabled) {
      throw new Error("PulseStackClient: apiKey is required unless disabled: true is provided.");
    }

    this.config = {
      apiKey: config.apiKey || "",
      endpoint: (config.endpoint || "http://localhost:3001").replace(/\/+$/, ""),
      maxBatchSize: Math.min(500, Math.max(1, config.maxBatchSize ?? 50)),
      flushIntervalMs: Math.max(100, config.flushIntervalMs ?? 2000),
      maxBufferSize: Math.max(10, config.maxBufferSize ?? 2000),
      timeoutMs: Math.max(500, config.timeoutMs ?? 5000),
      maxRetries: Math.max(0, config.maxRetries ?? 2),
      disabled: Boolean(config.disabled),
      onError: config.onError,
    };

    this.queue = new BoundedQueue(this.config.maxBufferSize, (dropped) => {
      if (this.config.onError) {
        this.config.onError(
          new Error(`PulseStack buffer full: dropped ${dropped} oldest telemetry events`)
        );
      }
    });

    this.flusher = new TelemetryFlusher(this.config);

    if (!this.config.disabled) {
      this.startTimer();
    }
  }

  /**
   * Enqueues an HTTP request event. Non-blocking and zero overhead.
   */
  public recordHttpRequest(input: HttpRequestInput): void {
    if (this.config.disabled || this.isClosed) return;

    const event: HttpRequestEvent = {
      type: "http_request",
      id: input.id || generateEventId(),
      timestamp: formatTimestamp(input.timestamp),
      method: input.method,
      path: input.path,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      clientIp: input.clientIp,
      userAgent: input.userAgent,
      headers: input.headers,
      queryParams: input.queryParams,
      requestBodySize: input.requestBodySize,
      responseBodySize: input.responseBodySize,
    };

    this.enqueue(event);
  }

  /**
   * Enqueues an error event.
   */
  public captureError(err: Error | string | ErrorInput, options?: { handled?: boolean; context?: Record<string, unknown> }): void {
    if (this.config.disabled || this.isClosed) return;

    let event: ErrorEvent;

    if (typeof err === "string") {
      event = {
        type: "error",
        id: generateEventId(),
        timestamp: formatTimestamp(),
        name: "Error",
        message: err,
        handled: options?.handled ?? false,
        context: options?.context,
      };
    } else if (err instanceof Error) {
      event = {
        type: "error",
        id: generateEventId(),
        timestamp: formatTimestamp(),
        name: err.name || "Error",
        message: err.message || "",
        stack: err.stack,
        handled: options?.handled ?? false,
        context: options?.context,
      };
    } else {
      event = {
        type: "error",
        id: err.id || generateEventId(),
        timestamp: formatTimestamp(err.timestamp),
        name: err.name || "Error",
        message: err.message || "",
        stack: err.stack,
        fingerprint: err.fingerprint,
        handled: err.handled ?? options?.handled ?? false,
        context: err.context ?? options?.context,
      };
    }

    this.enqueue(event);
  }

  /**
   * Enqueues a custom business event.
   */
  public captureEvent(nameOrInput: string | CustomEventInput, payload?: Record<string, unknown>): void {
    if (this.config.disabled || this.isClosed) return;

    let event: CustomEvent;

    if (typeof nameOrInput === "string") {
      event = {
        type: "custom_event",
        id: generateEventId(),
        timestamp: formatTimestamp(),
        name: nameOrInput,
        payload,
      };
    } else {
      event = {
        type: "custom_event",
        id: nameOrInput.id || generateEventId(),
        timestamp: formatTimestamp(nameOrInput.timestamp),
        name: nameOrInput.name,
        payload: nameOrInput.payload ?? payload,
        attributes: nameOrInput.attributes,
      };
    }

    this.enqueue(event);
  }

  /**
   * Flushes currently queued events to PulseStack.
   */
  public async flush(): Promise<void> {
    if (this.config.disabled || this.isFlushing || this.queue.length === 0) {
      return;
    }

    this.isFlushing = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.drain(this.config.maxBatchSize);
        if (batch.length === 0) break;

        const result = await this.flusher.sendBatch(batch);

        if (!result.success && result.shouldRetry) {
          // Re-insert unacknowledged events back into the front of the queue
          this.queue.unshiftBatch(batch);
          break; // Stop further drain loops during this flush run
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Graceful shutdown: stops interval timer and flushes any pending telemetry.
   */
  public async close(timeoutMs = 3000): Promise<void> {
    if (this.closePromise) {
      return this.closePromise;
    }

    this.isClosed = true;
    this.stopTimer();

    this.closePromise = (async () => {
      if (this.queue.length === 0) return;

      const timeout = new Promise<void>((resolve) => {
        setTimeout(resolve, timeoutMs).unref?.();
      });

      try {
        await Promise.race([this.flush(), timeout]);
      } catch (err) {
        if (this.config.onError && err instanceof Error) {
          this.config.onError(err);
        }
      }
    })();

    return this.closePromise;
  }

  public get pendingEventsCount(): number {
    return this.queue.length;
  }

  private enqueue(event: TelemetryEvent): void {
    this.queue.push(event);
    if (this.queue.length >= this.config.maxBatchSize && !this.isFlushing) {
      // Trigger non-blocking asynchronous flush
      void this.flush();
    }
  }

  private startTimer(): void {
    this.stopTimer();
    this.timer = setInterval(() => {
      void this.flush();
    }, this.config.flushIntervalMs);
    // Unref timer so Node process is not blocked from exiting
    this.timer.unref?.();
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
