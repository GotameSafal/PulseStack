import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const AlertMetricEnum = z.enum([
  "error_rate",
  "p95_latency_ms",
  "request_volume",
]);

export const AlertConditionEnum = z.enum(["gt", "lt", "gte", "lte"]);

// ---------------------------------------------------------------------------
// CRUD schemas
// ---------------------------------------------------------------------------

export const CreateAlertRuleSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(2000).optional(),
  metric: AlertMetricEnum,
  threshold: z.number().finite(),
  condition: AlertConditionEnum,
  windowMinutes: z.number().int().min(1).max(1440).default(5),
  cooldownMinutes: z.number().int().min(1).max(1440).default(15),
  enabled: z.boolean().default(true),
});

export const UpdateAlertRuleSchema = CreateAlertRuleSchema.partial();

export const AlertRuleResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  metric: AlertMetricEnum,
  threshold: z.number(),
  condition: AlertConditionEnum,
  windowMinutes: z.number().int(),
  cooldownMinutes: z.number().int(),
  enabled: z.boolean(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type AlertMetric = z.infer<typeof AlertMetricEnum>;
export type AlertCondition = z.infer<typeof AlertConditionEnum>;
export type CreateAlertRule = z.infer<typeof CreateAlertRuleSchema>;
export type UpdateAlertRule = z.infer<typeof UpdateAlertRuleSchema>;
export type AlertRuleResponse = z.infer<typeof AlertRuleResponseSchema>;
