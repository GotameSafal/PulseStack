import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const IncidentStatusEnum = z.enum(["open", "resolved"]);

// ---------------------------------------------------------------------------
// CRUD schemas
// ---------------------------------------------------------------------------

export const UpdateIncidentSchema = z.object({
  notes: z.string().max(5000).optional(),
  status: IncidentStatusEnum.optional(),
});

export const IncidentResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  alertRuleId: z.string(),
  status: IncidentStatusEnum,
  title: z.string(),
  triggerValue: z.number(),
  notes: z.string().nullable().optional(),
  openedAt: z.date().or(z.string()),
  resolvedAt: z.date().or(z.string()).nullable().optional(),
});

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type IncidentStatus = z.infer<typeof IncidentStatusEnum>;
export type UpdateIncident = z.infer<typeof UpdateIncidentSchema>;
export type IncidentResponse = z.infer<typeof IncidentResponseSchema>;
