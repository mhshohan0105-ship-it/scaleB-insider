// Forms for vouchers, expense heads, loans and payroll (PLAN.md 6.9 to 6.13).
import { z } from "zod";
import { businessDate } from "@/lib/dates";
import { MONEY_RE, PERCENT_RE } from "@/lib/masters";

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const blankToZero = (v: unknown) => (v === null || v === undefined || v === "" ? "0" : v);
const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.string().trim().max(max).nullable().optional());
const optionalId = z.preprocess(blankToNull, z.string().max(40).nullable().optional());
const positive = (s: string) => /[1-9]/.test(s);

export const money = (label: string) =>
  z
    .union([z.string(), z.number()], { error: `${label} is required` })
    .transform((v) => String(v).trim())
    .pipe(z.string().regex(MONEY_RE, `${label} must be an amount with up to 2 decimals`));
const optionalMoney = (label: string) => z.preprocess(blankToZero, money(label));
const amount = money("Amount").refine(positive, "Amount must be more than 0");

export const VOUCHER_KINDS = [
  "EXPENSE",
  "NON_INVOICE_INCOME",
  "INCENTIVE_INCOME",
  "AGENT_PAYMENT",
  "EMPLOYEE_ADVANCE",
  "BILL_ADJUSTMENT",
  "INVESTMENT",
  "INVESTMENT_RETURN",
  "SET_OFF",
] as const;
export type VoucherKindKey = (typeof VOUCHER_KINDS)[number];

export const PARTY_TYPES = ["CLIENT", "COMBINED", "VENDOR", "AGENT", "EMPLOYEE"] as const;

/** One schema for every voucher kind; the service checks what each kind needs. */
export const voucherSchema = z.object({
  date: businessDate("Date"),
  amount,
  profit: optionalMoney("Gain"),
  moneyAccountId: optionalId,
  partyType: z.preprocess(blankToNull, z.enum(PARTY_TYPES).nullable().optional()),
  partyId: optionalId,
  expenseHeadId: optionalId,
  direction: z.preprocess(
    blankToNull,
    z.enum(["INCREASE_DUE", "DECREASE_DUE"]).nullable().optional(),
  ),
  investmentId: optionalId,
  title: optionalText(120),
  reference: optionalText(80),
  note: optionalText(500),
});
export type VoucherInput = z.input<typeof voucherSchema>;

export const expenseHeadSchema = z.object({
  name: z.string({ error: "Name is required" }).trim().min(2, "Name is required").max(80),
  note: optionalText(300),
});

export const loanAuthoritySchema = z.object({
  name: z.string({ error: "Name is required" }).trim().min(2, "Name is required").max(120),
  type: z.enum(["BANK", "PERSON", "COMPANY"]).default("BANK"),
  phone: optionalText(30),
  address: optionalText(300),
  note: optionalText(300),
});

export const loanSchema = z.object({
  kind: z.enum(["TAKEN", "GIVEN", "INVESTMENT"]),
  authorityId: z.string({ error: "Choose who" }).min(1, "Choose who"),
  date: businessDate("Date"),
  principal: amount,
  interestRate: z.preprocess(
    blankToZero,
    z
      .union([z.string(), z.number()])
      .transform((v) => String(v).trim())
      .pipe(z.string().regex(PERCENT_RE, "Rate: up to 4 decimals")),
  ),
  termMonths: z.preprocess(
    blankToNull,
    z.coerce.number().int().min(1, "At least 1 month").max(600).nullable().optional(),
  ),
  moneyAccountId: z.string({ error: "Choose the account" }).min(1, "Choose the account"),
  note: optionalText(500),
});

export const loanPaymentSchema = z
  .object({
    loanId: z.string({ error: "Choose the loan" }).min(1, "Choose the loan"),
    date: businessDate("Date"),
    principal: optionalMoney("Principal"),
    interest: optionalMoney("Interest"),
    moneyAccountId: z.string({ error: "Choose the account" }).min(1, "Choose the account"),
    note: optionalText(500),
  })
  .refine((v) => positive(v.principal) || positive(v.interest), {
    path: ["principal"],
    message: "Enter the principal, the interest, or both",
  });

const payLine = z.object({
  name: z.string({ error: "Name the item" }).trim().min(1, "Name the item").max(60),
  amount: money("Amount"),
});

export const payrollSchema = z.object({
  employeeId: z.string({ error: "Choose the employee" }).min(1, "Choose the employee"),
  month: z
    .string({ error: "Choose the month" })
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose the month"),
  date: businessDate("Payment date"),
  basic: money("Basic salary"),
  allowances: z.array(payLine).max(20).default([]),
  deductions: z.array(payLine).max(20).default([]),
  advanceAdjusted: optionalMoney("Advance adjusted"),
  moneyAccountId: z.string({ error: "Choose the account" }).min(1, "Choose the account"),
  note: optionalText(500),
});
export type PayrollInput = z.input<typeof payrollSchema>;

export const chequeActionSchema = z.object({
  date: businessDate("Date"),
  note: optionalText(300),
});

/** Combined client set-off: receivable settled against payable. */
export const setOffSchema = z.object({
  date: businessDate("Date"),
  amount,
  note: optionalText(500),
});
export type SetOffInput = z.input<typeof setOffSchema>;
