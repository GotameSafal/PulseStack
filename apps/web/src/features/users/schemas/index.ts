import * as z from "zod";

export const UserSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "MANAGER", "USER"]),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export type UserType = z.infer<typeof UserSchema>;
