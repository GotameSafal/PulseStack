import { z } from "zod";

export const CreateApiKeySchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  name: z.string().min(2, "API key label must be at least 2 characters"),
  rateLimitTier: z.enum(["standard", "pro", "enterprise"]).default("standard"),
});

export const ApiKeyResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  secretKey: z.string().optional(),
  rateLimitTier: z.string(),
  lastUsedAt: z.date().or(z.string()).nullable().optional(),
  createdAt: z.date().or(z.string()),
});
