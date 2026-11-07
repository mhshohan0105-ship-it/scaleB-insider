import { z } from "zod";
import { MONEY_RE } from "@/lib/masters";
import { PLAN_MODULES } from "@/lib/subscription";

const money = (label: string) =>
  z
    .union([z.string(), z.number()], { error: `${label} is required` })
    .transform((v) => String(v).trim())
    .pipe(z.string().regex(MONEY_RE, `${label} must be an amount with up to 2 decimals`));

const isoDate = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31")
    .nullable(),
);

/** Platform admin: add or edit a plan. */
export const planSchema = z.object({
  code: z
    .string({ error: "Code is required" })
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,38}$/, "2 to 39 lowercase letters, digits or dashes"),
  name: z.string({ error: "Name is required" }).trim().min(2, "Name is required").max(80),
  priceMonthly: money("Monthly price"),
  priceYearly: money("Yearly price"),
  maxUsers: z.coerce
    .number({ error: "User limit is required" })
    .int("Whole number")
    .min(0, "0 or more")
    .max(10_000),
  /** Optional modules included; empty means every module. */
  modules: z.array(z.enum(PLAN_MODULES as [string, ...string[]])).default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});

export type PlanInput = z.input<typeof planSchema>;

/** Platform admin: an agency's plan, trial end and paid-up date (dates in Dhaka). */
export const subscriptionSchema = z
  .object({
    plan: z.string().trim().min(1, "Choose a plan").max(40),
    status: z.enum(["TRIAL", "ACTIVE"]),
    trialEndsAt: isoDate,
    paidUntil: isoDate,
  })
  .refine((v) => v.status !== "TRIAL" || v.trialEndsAt, {
    path: ["trialEndsAt"],
    message: "A trial needs an end date",
  });

export type SubscriptionInput = z.input<typeof subscriptionSchema>;
