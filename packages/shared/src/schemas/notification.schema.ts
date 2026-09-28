import { z } from "zod";

export const ChannelTypeEnum = z.enum(["webhook", "slack"]);

export const CreateNotificationChannelSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  type: ChannelTypeEnum,
  destinationUrl: z.string().url("Must be a valid URL"),
  signingSecret: z.string().optional(),
  enabled: z.boolean().default(true),
});

export const UpdateNotificationChannelSchema = CreateNotificationChannelSchema.partial();

export const NotificationChannelResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  type: ChannelTypeEnum,
  /** Masked URL — never returns the raw destination URL */
  maskedUrl: z.string(),
  enabled: z.boolean(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});

export type ChannelType = z.infer<typeof ChannelTypeEnum>;
export type CreateNotificationChannel = z.infer<typeof CreateNotificationChannelSchema>;
export type UpdateNotificationChannel = z.infer<typeof UpdateNotificationChannelSchema>;
export type NotificationChannelResponse = z.infer<typeof NotificationChannelResponseSchema>;
