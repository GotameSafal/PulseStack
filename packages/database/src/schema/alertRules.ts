import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  real,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";

/**
 * Metric types that the alert evaluation engine can monitor.
 */
export type AlertMetric = "error_rate" | "p95_latency_ms" | "request_volume";

/**
 * Comparison operators for threshold evaluation.
 */
export type AlertCondition = "gt" | "lt" | "gte" | "lte";

/**
 * alert_rules — stores project-scoped alert rule configurations.
 *
 * Each rule polls a ClickHouse metric and triggers an incident when the
 * threshold condition is violated over the specified evaluation window.
 */
export const alertRules = pgTable(
  "alert_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    /** Human-readable rule name, e.g. "High Error Rate" */
    name: varchar("name", { length: 255 }).notNull(),

    /** Optional longer description or runbook notes */
    description: text("description"),

    /** The ClickHouse metric to evaluate */
    metric: varchar("metric", { length: 64 }).notNull(), // AlertMetric

    /** Threshold value the metric is compared against */
    threshold: real("threshold").notNull(),

    /** Comparison direction: gt | lt | gte | lte */
    condition: varchar("condition", { length: 8 }).notNull(), // AlertCondition

    /** Lookback window in minutes for the ClickHouse query */
    windowMinutes: integer("window_minutes").notNull().default(5),

    /** Cooldown period in minutes before the rule can re-fire */
    cooldownMinutes: integer("cooldown_minutes").notNull().default(15),

    /** Whether the rule is actively evaluated */
    enabled: boolean("enabled").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("alert_rules_project_id_idx").on(table.projectId),
    index("alert_rules_enabled_idx").on(table.enabled),
  ]
);

export type AlertRule = typeof alertRules.$inferSelect;
export type NewAlertRule = typeof alertRules.$inferInsert;
