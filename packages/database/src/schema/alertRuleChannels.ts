import { pgTable, uuid, timestamp, index, unique } from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { alertRules } from "./alertRules";
import { notificationChannels } from "./notificationChannels";

/**
 * alert_rule_channels — many-to-many join between alert rules and notification channels.
 */
export const alertRuleChannels = pgTable(
  "alert_rule_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    alertRuleId: uuid("alert_rule_id")
      .notNull()
      .references(() => alertRules.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => notificationChannels.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("alert_rule_channels_alert_rule_id_idx").on(table.alertRuleId),
    index("alert_rule_channels_channel_id_idx").on(table.channelId),
    index("alert_rule_channels_project_id_idx").on(table.projectId),
    unique("alert_rule_channels_rule_channel_unique_idx").on(table.alertRuleId, table.channelId),
  ]
);

export type AlertRuleChannel = typeof alertRuleChannels.$inferSelect;
export type NewAlertRuleChannel = typeof alertRuleChannels.$inferInsert;
