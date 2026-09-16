import { z } from "zod";

export const OrganizationRoleEnum = z.enum(["OWNER", "ADMIN", "MEMBER"]);

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
});

export const OrganizationMemberSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  role: OrganizationRoleEnum,
  createdAt: z.date().or(z.string()),
});
