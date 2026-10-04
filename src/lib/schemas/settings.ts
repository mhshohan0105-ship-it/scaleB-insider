import { z } from "zod";
import { DOCUMENT_TYPES, prefixSchema } from "@/lib/documentPrefixes";
import { PERCENT_RE } from "@/lib/masters";

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(max).nullable().optional(),
  );

export const appConfigSchema = z.object({
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "Use a 3 letter currency code")
    .transform((s) => s.toUpperCase()),
  fiscalYearStart: z.coerce.number().int().min(1).max(12),
  aitRatePercent: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(
      z
        .string()
        .regex(PERCENT_RE, "Up to 4 decimals")
        .refine((s) => Number(s) <= 100, "Cannot exceed 100"),
    ),
  aitBase: z.enum(["BASE_FARE", "TOTAL_FARE"]),
  commissionBase: z.enum(["BASE_FARE", "TOTAL_FARE"]),
  invoicePrefixes: z.object(
    Object.fromEntries(DOCUMENT_TYPES.map((d) => [d.key, prefixSchema])) as Record<
      (typeof DOCUMENT_TYPES)[number]["key"],
      typeof prefixSchema
    >,
  ),
  invoiceFooter: optionalText(500),
  invoiceTerms: optionalText(2000),
  smsEnabled: z.boolean(),
});

export type AppConfigInput = z.input<typeof appConfigSchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Agency name is required").max(120),
  address: optionalText(300),
  phone: optionalText(30),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().email("Enter a valid email").max(120).nullable().optional(),
  ),
  website: optionalText(200),
  tradeLicense: optionalText(60),
  iataNo: optionalText(30),
  logoUrl: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().url("Enter a full URL starting with https://").max(500).nullable().optional(),
  ),
});

export type ProfileInput = z.input<typeof profileSchema>;
