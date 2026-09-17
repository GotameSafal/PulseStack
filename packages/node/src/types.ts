import type {
  HttpRequestEvent,
  ErrorEvent,
  DatabaseQueryEvent,
  BackgroundJobEvent,
  CustomEvent,
  TelemetryEvent,
  HttpMethod,
} from "@pulsestack/shared";

export interface PulseStackConfig {
  /** The project ingestion API key (e.g. ps_live_...) */
  apiKey: string;
  /** PulseStack API base URL, defaults to http://localhost:3001 */
  endpoint?: string;
  /** Maximum number of events in a single ingestion batch (default: 50, max: 500) */
  maxBatchSize?: number;
  /** Background flush debounce interval in milliseconds (default: 2000) */
  flushIntervalMs?: number;
  /** Maximum number of events stored in the in-memory queue before dropping (default: 2000) */
  maxBufferSize?: number;
  /** Request timeout in milliseconds for HTTP POST /v1/ingest (default: 5000) */
  timeoutMs?: number;
  /** Maximum retry attempts for transient network/server failures (default: 2) */
  maxRetries?: number;
  /** Disable telemetry collection (useful in testing or staging environments) */
  disabled?: boolean;
  /** Optional error callback for internal SDK logging/diagnostics without crashing */
  onError?: (err: Error) => void;
}

/** Input payload for recording an HTTP request (id & timestamp are optional, auto-populated if omitted) */
export type HttpRequestInput = Omit<HttpRequestEvent, "type" | "id" | "timestamp"> & {
  id?: string;
  timestamp?: string | Date;
};

/** Input payload for capturing an error */
export type ErrorInput = {
  name: string;
  message: string;
  stack?: string;
  fingerprint?: string;
  handled?: boolean;
  context?: Record<string, unknown>;
  id?: string;
  timestamp?: string | Date;
};

/** Input payload for recording custom business events */
export type CustomEventInput = {
  name: string;
  payload?: Record<string, unknown>;
  attributes?: Record<string, string>;
  id?: string;
  timestamp?: string | Date;
};

export type { TelemetryEvent, HttpRequestEvent, ErrorEvent, DatabaseQueryEvent, BackgroundJobEvent, CustomEvent, HttpMethod };

