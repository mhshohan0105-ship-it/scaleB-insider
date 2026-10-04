import { z } from "zod";

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const passwordRule = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(200)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Use both letters and numbers");

const userFields = {
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.preprocess(
    blankToNull,
    z.string().trim().email("Enter a valid email").max(120).nullable(),
  ),
  phone: z.preprocess(blankToNull, z.string().trim().max(30).nullable()),
  roleId: z.string().min(1, "Choose a role"),
  employeeId: z.preprocess(blankToNull, z.string().max(40).nullable()),
};

export const userCreateSchema = z.object({
  ...userFields,
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,60}$/, "3 to 60 characters: letters, digits, dot, dash, underscore"),
  password: passwordRule,
});

export const userUpdateSchema = z.object(userFields);

export const resetPasswordSchema = z.object({ password: passwordRule });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password different from the current one",
  });

export type UserCreateInput = z.input<typeof userCreateSchema>;
export type UserUpdateInput = z.input<typeof userUpdateSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
