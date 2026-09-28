import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";

/**
 * notification_channels — stores external incident notification destinations.
 *
 * destinationUrl and signingSecret are encrypted at rest using AES-256-GCM.
 */
export const notificationChannels = pgTable(
  "notification_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    /** Friendly name, e.g. "DevOps Slack Alert" or "Ops Webhook" */
    name: varchar("name", { length: 255 }).notNull(),

    /** webhook | slack */
    type: varchar("type", { length: 32 }).notNull(),

    /**
     * Encrypted destination URL at rest (AES-256-GCM in format `iv:authTag:ciphertext`).
     */
    destinationUrl: text("destination_url").notNull(),

    /**
     * Optional encrypted HMAC signing secret for webhook verification.
     */
    signingSecret: text("signing_secret"),

    /** Whether outbound delivery is currently enabled for this channel */
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
    index("notification_channels_project_id_idx").on(table.projectId),
    index("notification_channels_enabled_idx").on(table.enabled),
  ]
);

export type NotificationChannel = typeof notificationChannels.$inferSelect;
export type NewNotificationChannel = typeof notificationChannels.$inferInsert;
