import { z } from "zod";
import { passwordRule } from "./users";

const mobile = z
  .string({ error: "Enter your mobile number" })
  .trim()
  .regex(/^(\+?88)?01[3-9]\d{8}$/, "Mobile number like 01XXXXXXXXX");

/** Step 1 of sign-up: send a code to this mobile number. */
export const signupCodeSchema = z.object({ phone: mobile });

/** Step 2 of sign-up: the new agency, its owner, and the code that came by SMS. */
export const signupSchema = z.object({
  agencyName: z
    .string({ error: "Enter the agency name" })
    .trim()
    .min(2, "Enter the agency name")
    .max(120),
  code: z
    .string({ error: "Choose an agency code" })
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,38}$/, "2 to 39 lowercase letters, digits or dashes"),
  ownerName: z.string({ error: "Enter your name" }).trim().min(2, "Enter your name").max(120),
  phone: mobile,
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().email("Enter a valid email").max(120).optional(),
  ),
  username: z
    .string({ error: "Choose a username" })
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,60}$/, "3 to 60 characters: letters, digits, dot, dash, underscore"),
  password: passwordRule,
  /** The code sent by SMS; not asked when this installation sends no SMS. */
  otp: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter the 6 digit code")
      .optional(),
  ),
  acceptTerms: z.literal(true, { error: "Please accept the Terms and Privacy Policy" }),
  /** Left empty by people; filled by form-filling bots. */
  website: z.string().max(0).optional().or(z.literal("")),
});

export type SignupInput = z.input<typeof signupSchema>;
