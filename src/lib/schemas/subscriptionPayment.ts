import { z } from "zod";
import { businessDate } from "@/lib/dates";
import { MONEY_RE } from "@/lib/masters";

export const SUBSCRIPTION_METHOD_OPTIONS = [
  { value: "MOBILE", label: "bKash / Nagad" },
  { value: "BANK", label: "Bank" },
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
] as const;

/** Platform admin: money an agency paid for its plan. */
export const subscriptionPaymentSchema = z.object({
  date: businessDate("Payment date"),
  amount: z
    .union([z.string(), z.number()], { error: "Amount is required" })
    .transform((v) => String(v).trim())
    .pipe(
      z
        .string()
        .regex(MONEY_RE, "Amount must have up to 2 decimals")
        .refine((s) => /[1-9]/.test(s), "Amount must be more than 0"),
    ),
  method: z.enum(["MOBILE", "BANK", "CASH", "CARD"], { error: "Choose how it was paid" }),
  reference: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(80).nullable().optional(),
  ),
  plan: z.string({ error: "Choose a plan" }).trim().min(1, "Choose a plan").max(40),
  months: z.coerce.number({ error: "Months" }).int().min(1, "At least 1").max(36, "At most 36"),
  note: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(500).nullable().optional(),
  ),
});

export type SubscriptionPaymentInput = z.input<typeof subscriptionPaymentSchema>;

export const voidPaymentSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason (at least 3 characters)").max(500),
});
