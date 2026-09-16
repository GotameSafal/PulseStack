import { z } from "zod";

export const ProjectEnvironmentEnum = z.enum([
  "development",
  "staging",
  "production",
]);

export const CreateProjectSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  name: z.string().min(2, "Project name must be at least 2 characters"),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  environment: ProjectEnvironmentEnum.default("development"),
});

export const ProjectResponseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  slug: z.string(),
  environment: ProjectEnvironmentEnum,
  createdAt: z.date().or(z.string()),
});
