import {
  pgTable,
  uuid,
  varchar,
  text,
  real,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projects } from "./projects";
import { alertRules } from "./alertRules";

/**
 * Incident lifecycle states.
 */
export type IncidentStatus = "open" | "resolved";

/**
 * incidents — records each alert rule violation and its resolution.
 *
 * Incidents are created by the evaluation engine when a rule threshold is
 * breached, and auto-resolved when the metric returns below the threshold.
 */
export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Owning project (denormalized for fast multi-tenant queries) */
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    /** The rule that triggered this incident */
    alertRuleId: uuid("alert_rule_id")
      .notNull()
      .references(() => alertRules.id, { onDelete: "cascade" }),

    /** open | resolved */
    status: varchar("status", { length: 16 }).notNull().default("open"), // IncidentStatus

    /** Human-readable title copied from the rule at trigger time */
    title: varchar("title", { length: 255 }).notNull(),

    /** Metric value that triggered the rule */
    triggerValue: real("trigger_value").notNull(),

    /** Optional auto-generated or human-provided notes */
    notes: text("notes"),

    /** Timestamp when the incident was first opened */
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),

    /** Timestamp when the incident was resolved (null if still open) */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("incidents_project_id_idx").on(table.projectId),
    index("incidents_alert_rule_id_idx").on(table.alertRuleId),
    index("incidents_status_idx").on(table.status),
    index("incidents_opened_at_idx").on(table.openedAt),
    uniqueIndex("incidents_one_open_per_rule_idx")
      .on(table.alertRuleId)
      .where(sql`${table.status} = 'open'`),
  ]
);

export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
