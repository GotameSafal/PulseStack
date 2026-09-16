import { z } from "zod";

export const RegisterInputSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  organizationName: z
    .string()
    .min(2, "Organization name must be at least 2 characters"),
});

export const LoginInputSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const UserAuthResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  token: z.string(),
  activeOrganizationId: z.string().optional(),
});
