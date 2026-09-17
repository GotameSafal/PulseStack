import {
  TelemetryEvent,
  HttpRequestEvent,
  ErrorEvent,
  DatabaseQueryEvent,
  BackgroundJobEvent,
  CustomEvent,
} from "@pulsestack/shared";

export interface MappedRow {
  table: string;
  row: Record<string, unknown>;
}

export function formatDateTime64(timestamp: string | Date): string {
  const d = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }
  // ClickHouse DateTime64(3, 'UTC') format: 'YYYY-MM-DD HH:mm:ss.SSS'
  return d.toISOString().replace("T", " ").replace("Z", "");
}

export function mapHttpRequest(
  event: HttpRequestEvent,
  projectId: string
): MappedRow {
  return {
    table: "http_requests",
    row: {
      id: event.id,
      project_id: projectId,
      timestamp: formatDateTime64(event.timestamp),
      method: event.method,
      path: event.path,
      status_code: event.statusCode,
      duration_ms: event.durationMs,
      client_ip: event.clientIp ?? null,
      user_agent: event.userAgent ?? null,
      headers: event.headers ?? {},
      query_params: event.queryParams ?? {},
      request_body_size: event.requestBodySize ?? null,
      response_body_size: event.responseBodySize ?? null,
    },
  };
}

export function mapError(event: ErrorEvent, projectId: string): MappedRow {
  return {
    table: "errors",
    row: {
      id: event.id,
      project_id: projectId,
      timestamp: formatDateTime64(event.timestamp),
      name: event.name,
      message: event.message,
      stack: event.stack ?? null,
      fingerprint: event.fingerprint ?? null,
      handled: event.handled ?? false,
      context: JSON.stringify(event.context ?? {}),
    },
  };
}

export function mapDatabaseQuery(
  event: DatabaseQueryEvent,
  projectId: string
): MappedRow {
  return {
    table: "database_queries",
    row: {
      id: event.id,
      project_id: projectId,
      timestamp: formatDateTime64(event.timestamp),
      query: event.query,
      duration_ms: event.durationMs,
      table_name: event.table ?? null,
      driver: event.driver ?? null,
      rows_affected: event.rowsAffected ?? null,
    },
  };
}

export function mapBackgroundJob(
  event: BackgroundJobEvent,
  projectId: string
): MappedRow {
  return {
    table: "background_jobs",
    row: {
      id: event.id,
      project_id: projectId,
      timestamp: formatDateTime64(event.timestamp),
      queue: event.queue,
      name: event.name,
      duration_ms: event.durationMs,
      status: event.status,
      attempts: event.attempts ?? 1,
    },
  };
}

export function mapCustomEvent(
  event: CustomEvent,
  projectId: string
): MappedRow {
  return {
    table: "custom_events",
    row: {
      id: event.id,
      project_id: projectId,
      timestamp: formatDateTime64(event.timestamp),
      name: event.name,
      payload: JSON.stringify(event.payload ?? {}),
      attributes: event.attributes ?? {},
    },
  };
}

export function mapTelemetryEvent(
  event: TelemetryEvent,
  projectId: string
): MappedRow {
  switch (event.type) {
    case "http_request":
      return mapHttpRequest(event, projectId);
    case "error":
      return mapError(event, projectId);
    case "database_query":
      return mapDatabaseQuery(event, projectId);
    case "background_job":
      return mapBackgroundJob(event, projectId);
    case "custom_event":
      return mapCustomEvent(event, projectId);
    default: {
      const _exhaustiveCheck: never = event;
      throw new Error(`Unhandled telemetry event type: ${JSON.stringify(_exhaustiveCheck)}`);
    }
  }
}
