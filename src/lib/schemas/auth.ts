import { z } from "zod";

export const loginSchema = z.object({
  agencyCode: z.string().trim().toLowerCase().min(1, "Agency code is required").max(40),
  username: z.string().trim().toLowerCase().min(1, "Username is required").max(60),
  password: z.string().min(1, "Password is required").max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;
