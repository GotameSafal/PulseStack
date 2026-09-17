import { z } from "zod";

export const HttpMethodEnum = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

export const HttpRequestEventSchema = z.object({
  type: z.literal("http_request"),
  id: z.string().min(1),
  timestamp: z.string().or(z.date()),
  method: HttpMethodEnum,
  path: z.string().min(1),
  statusCode: z.number().int().min(100).max(599),
  durationMs: z.number().nonnegative(),
  clientIp: z.string().optional(),
  userAgent: z.string().optional(),
  headers: z.record(z.string()).optional(),
  queryParams: z.record(z.string()).optional(),
  requestBodySize: z.number().int().nonnegative().optional(),
  responseBodySize: z.number().int().nonnegative().optional(),
});

export const ErrorEventSchema = z.object({
  type: z.literal("error"),
  id: z.string().min(1),
  timestamp: z.string().or(z.date()),
  name: z.string().min(1),
  message: z.string(),
  stack: z.string().optional(),
  fingerprint: z.string().optional(),
  handled: z.boolean().default(false),
  context: z.record(z.unknown()).optional(),
});

export const DatabaseQueryEventSchema = z.object({
  type: z.literal("database_query"),
  id: z.string().min(1),
  timestamp: z.string().or(z.date()),
  query: z.string().min(1),
  durationMs: z.number().nonnegative(),
  table: z.string().optional(),
  driver: z.string().optional(),
  rowsAffected: z.number().int().nonnegative().optional(),
});

export const BackgroundJobEventSchema = z.object({
  type: z.literal("background_job"),
  id: z.string().min(1),
  timestamp: z.string().or(z.date()),
  queue: z.string().min(1),
  name: z.string().min(1),
  durationMs: z.number().nonnegative(),
  status: z.enum(["started", "completed", "failed"]),
  attempts: z.number().int().min(1).default(1),
});

export const CustomEventSchema = z.object({
  type: z.literal("custom_event"),
  id: z.string().min(1),
  timestamp: z.string().or(z.date()),
  name: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  attributes: z.record(z.string()).optional(),
});

export const TelemetryEventSchema = z.discriminatedUnion("type", [
  HttpRequestEventSchema,
  ErrorEventSchema,
  DatabaseQueryEventSchema,
  BackgroundJobEventSchema,
  CustomEventSchema,
]);

export const IngestBatchPayloadSchema = z.object({
  sentAt: z.string().or(z.date()).optional(),
  events: z.array(TelemetryEventSchema).min(1).max(1000),
});
