// Hajj forms (PLAN.md 6.17): pilgrim, registration, transfers, cancellation.
import { z } from "zod";
import { businessDate } from "@/lib/dates";
import { MONEY_RE } from "@/lib/masters";

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const blankToZero = (v: unknown) => (v === null || v === undefined || v === "" ? "0" : v);
const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.string().trim().max(max).nullable().optional());
const upperText = (max: number) =>
  z.preprocess(
    blankToNull,
    z
      .string()
      .trim()
      .max(max)
      .transform((s) => s.toUpperCase())
      .nullable()
      .optional(),
  );
const optionalId = z.preprocess(blankToNull, z.string().max(40).nullable().optional());
const optionalDate = (label: string) =>
  z.preprocess(blankToNull, businessDate(label).nullable().optional());
const money = (label: string) =>
  z.preprocess(
    blankToZero,
    z
      .union([z.string(), z.number()])
      .transform((v) => String(v).trim())
      .pipe(z.string().regex(MONEY_RE, `${label} must be an amount with up to 2 decimals`)),
  );
const year = z.coerce
  .number({ error: "Hajj year is required" })
  .int()
  .min(2000, "Enter a valid year")
  .max(2100, "Enter a valid year");

const pilgrimFields = {
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(2, "Name is required")
    .max(120)
    .transform((s) => s.toUpperCase()),
  gender: z.preprocess(blankToNull, z.enum(["MALE", "FEMALE"]).nullable().optional()),
  dateOfBirth: optionalDate("Date of birth"),
  passportNo: upperText(20),
  passportExpiry: optionalDate("Passport expiry"),
  nidNo: optionalText(30),
  phone: optionalText(30),
  address: optionalText(300),
  trackingNo: upperText(30),
  preRegNo: upperText(30),
  preRegDate: optionalDate("Pre registration date"),
  maharamId: optionalId,
  maharamName: optionalText(120),
  note: optionalText(500),
};

export const pilgrimSchema = z.object({
  clientId: z.string({ error: "Choose the client who pays" }).min(1, "Choose the client who pays"),
  hajjYear: year,
  groupId: optionalId,
  moallem: optionalText(120),
  ...pilgrimFields,
});
export type PilgrimInput = z.input<typeof pilgrimSchema>;

export const registerSchema = z.object({
  regNo: z
    .string({ error: "Registration number is required" })
    .trim()
    .min(1, "Registration number is required")
    .max(30)
    .transform((s) => s.toUpperCase()),
  regDate: businessDate("Registration date"),
  voucherNo: upperText(30),
  trackingNo: upperText(30),
});

export const cancelPilgrimSchema = z.object({
  pilgrimId: z.string({ error: "Choose the pilgrim" }).min(1, "Choose the pilgrim"),
  date: businessDate("Cancel date"),
  reason: z.string({ error: "Give a reason" }).trim().min(3, "Give a reason").max(300),
});

const transferBase = {
  date: businessDate("Transfer date"),
  chargePerPilgrim: money("Charge"),
  note: optionalText(500),
};

const pilgrimIds = z
  .array(z.string().min(1))
  .min(1, "Choose at least one pilgrim")
  .max(500)
  .refine((ids) => new Set(ids).size === ids.length, "A pilgrim is listed twice");

export const moallemTransferSchema = z.object({
  ...transferBase,
  pilgrimIds,
  moallem: z
    .string({ error: "Enter the new moallem" })
    .trim()
    .min(1, "Enter the new moallem")
    .max(120),
});

export const groupTransferSchema = z.object({
  ...transferBase,
  pilgrimIds,
  groupId: z.string({ error: "Choose the new group" }).min(1, "Choose the new group"),
});

export const transferOutSchema = z.object({
  ...transferBase,
  pilgrimIds,
  agency: z.string({ error: "Enter the agency" }).trim().min(2, "Enter the agency").max(120),
});

export const transferInSchema = z.object({
  ...transferBase,
  agency: z.string({ error: "Enter the agency" }).trim().min(2, "Enter the agency").max(120),
  clientId: z.string({ error: "Choose the client who pays" }).min(1, "Choose the client who pays"),
  hajjYear: year,
  groupId: optionalId,
  moallem: optionalText(120),
  pilgrims: z
    .array(
      z.object({
        ...pilgrimFields,
        regNo: upperText(30),
        regDate: optionalDate("Registration date"),
        voucherNo: upperText(30),
      }),
    )
    .min(1, "Add at least one pilgrim")
    .max(200),
});
