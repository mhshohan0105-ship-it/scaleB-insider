// Passport and quotation forms (PLAN.md 6.15, 6.16).
import { z } from "zod";
import { businessDate } from "@/lib/dates";
import { money } from "./money";

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const blankToZero = (v: unknown) => (v === null || v === undefined || v === "" ? "0" : v);
const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.string().trim().max(max).nullable().optional());
const optionalId = z.preprocess(blankToNull, z.string().max(40).nullable().optional());
const optionalDate = (label: string) =>
  z.preprocess(blankToNull, businessDate(label).nullable().optional());
const positive = (s: string) => /[1-9]/.test(s);

export const passportSchema = z
  .object({
    passportNo: z
      .string({ error: "Passport number is required" })
      .trim()
      .regex(/^[A-Za-z0-9]{5,20}$/, "Passport number: 5 to 20 letters or digits")
      .transform((s) => s.toUpperCase()),
    name: z
      .string({ error: "Name is required" })
      .trim()
      .min(2, "Name is required")
      .max(120)
      .transform((s) => s.toUpperCase()),
    clientId: optionalId,
    gender: z.preprocess(blankToNull, z.enum(["MALE", "FEMALE"]).nullable().optional()),
    dateOfBirth: optionalDate("Date of birth"),
    nationality: z.preprocess(blankToNull, z.string().trim().max(60).nullable().optional()),
    placeOfIssue: optionalText(80),
    issueDate: optionalDate("Issue date"),
    expiryDate: businessDate("Expiry date"),
    phone: optionalText(30),
    statusId: optionalId,
    receivedDate: optionalDate("Received date"),
    returnedDate: optionalDate("Returned date"),
    note: optionalText(500),
  })
  .refine((v) => !v.issueDate || v.issueDate < v.expiryDate, {
    path: ["expiryDate"],
    message: "Expiry is before the issue date",
  })
  .refine((v) => !v.returnedDate || !v.receivedDate || v.returnedDate >= v.receivedDate, {
    path: ["returnedDate"],
    message: "Returned before it was received",
  });
export type PassportInput = z.input<typeof passportSchema>;

export const passportStatusChangeSchema = z.object({
  statusId: z.string({ error: "Choose the status" }).min(1, "Choose the status"),
  note: optionalText(300),
});

export const QUOTE_INVOICE_TYPES = ["OTHER", "OTHER_PACKAGE", "TOUR"] as const;

const QTY_RE = /^\d{1,6}(\.\d{1,2})?$/;

export const quotationLineSchema = z
  .object({
    description: z
      .string({ error: "Describe the item" })
      .trim()
      .min(1, "Describe the item")
      .max(300),
    qty: z
      .union([z.string(), z.number()], { error: "Quantity is required" })
      .transform((v) => String(v).trim())
      .pipe(z.string().regex(QTY_RE, "Quantity: up to 2 decimals").refine(positive, "More than 0")),
    unitPrice: money("Price"),
    unitCost: z.preprocess(blankToZero, money("Cost")),
    vendorId: optionalId,
    productId: optionalId,
  })
  .refine((l) => !positive(l.unitCost) || !!l.vendorId, {
    path: ["vendorId"],
    message: "Choose the vendor this cost is payable to",
  });

export const quotationSchema = z
  .object({
    clientId: z.string({ error: "Choose a client" }).min(1, "Choose a client"),
    date: businessDate("Date"),
    validUntil: businessDate("Valid until"),
    subject: optionalText(150),
    invoiceType: z.enum(QUOTE_INVOICE_TYPES).default("OTHER"),
    discount: z.preprocess(blankToZero, money("Discount")),
    note: optionalText(1000),
    terms: optionalText(2000),
    lines: z.array(quotationLineSchema).min(1, "Add at least one line").max(100),
  })
  .refine((v) => v.validUntil >= v.date, {
    path: ["validUntil"],
    message: "Valid until is before the quotation date",
  });
export type QuotationInput = z.input<typeof quotationSchema>;

export const quotationStatusSchema = z.object({
  status: z.enum(["SENT", "ACCEPTED", "REJECTED"]),
});
