import type { TelemetryEvent, PulseStackConfig } from "./types.js";

export interface FlusherResult {
  success: boolean;
  shouldRetry: boolean;
  statusCode?: number;
  error?: Error;
}

export class TelemetryFlusher {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly onError?: (err: Error) => void;

  constructor(config: PulseStackConfig) {
    const rawEndpoint = config.endpoint || "http://localhost:3001";
    // Strip trailing slash if present
    this.endpoint = rawEndpoint.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? 5000;
    this.maxRetries = config.maxRetries ?? 2;
    this.onError = config.onError;
  }

  /**
   * Posts a batch of events to /v1/ingest. Handles retry logic for transient errors.
   */
  public async sendBatch(events: TelemetryEvent[]): Promise<FlusherResult> {
    if (events.length === 0) {
      return { success: true, shouldRetry: false };
    }

    const payload = {
      sentAt: new Date().toISOString(),
      events,
    };

    const targetUrl = `${this.endpoint}/v1/ingest`;

    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt <= this.maxRetries) {
      attempt++;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.ok) {
          return { success: true, shouldRetry: false, statusCode: response.status };
        }

        // Handle specific status codes
        if (response.status === 401 || response.status === 403) {
          const err = new Error(`PulseStack ingestion authentication failed (${response.status})`);
          if (this.onError) this.onError(err);
          // Do not retry permanent auth errors
          return { success: false, shouldRetry: false, statusCode: response.status, error: err };
        }

        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          const err = new Error(`PulseStack ingestion client rejected payload (${response.status})`);
          if (this.onError) this.onError(err);
          // 4xx bad payload should not be retried indefinitely
          return { success: false, shouldRetry: false, statusCode: response.status, error: err };
        }

        // 429 Too Many Requests or 5xx Server Error -> transient retry candidate
        const err = new Error(`PulseStack ingestion transient HTTP error (${response.status})`);
        lastError = err;

        if (attempt <= this.maxRetries) {
          // Exponential jittered backoff
          const backoff = Math.min(1000, 100 * Math.pow(2, attempt));
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        return { success: false, shouldRetry: true, statusCode: response.status, error: err };
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;

        if (attempt <= this.maxRetries) {
          const backoff = Math.min(1000, 100 * Math.pow(2, attempt));
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        if (this.onError) {
          this.onError(error);
        }

        return { success: false, shouldRetry: true, error };
      }
    }

    return { success: false, shouldRetry: true, error: lastError };
  }
}
