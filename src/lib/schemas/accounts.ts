import { z } from "zod";
import { businessDate } from "@/lib/dates";
import { MONEY_RE } from "@/lib/masters";

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.string().trim().max(max).nullable().optional());

const money = (label: string) =>
  z
    .union([z.string(), z.number()], { error: `${label} is required` })
    .transform((v) => String(v).trim())
    .pipe(z.string().regex(MONEY_RE, `${label} must be an amount with up to 2 decimals`));

export const MONEY_ACCOUNT_KIND_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "BANK", label: "Bank" },
  { value: "MOBILE_BANKING", label: "Mobile banking" },
  { value: "CREDIT_CARD", label: "Credit card" },
] as const;

export const moneyAccountSchema = z.object({
  name: z.string().trim().min(2, "Account name is required").max(80),
  kind: z.enum(["CASH", "BANK", "MOBILE_BANKING", "CREDIT_CARD"]),
  bankName: optionalText(120),
  /** Full number as typed; only a masked form is stored. Blank on edit keeps the stored one. */
  accountNo: optionalText(40),
  branch: optionalText(120),
  openingBalance: money("Opening balance"),
  note: optionalText(500),
});

export type MoneyAccountInput = z.input<typeof moneyAccountSchema>;

export const balanceTransferSchema = z
  .object({
    date: businessDate("Date"),
    fromAccountId: z.string().min(1, "Choose the account to move money from"),
    toAccountId: z.string().min(1, "Choose the account to move money to"),
    // Positive without converting money to a float: some digit other than 0.
    amount: money("Amount").refine((s) => /[1-9]/.test(s), "Amount must be more than 0"),
    charge: z.preprocess(
      (v) => (v === null || v === undefined || v === "" ? "0" : v),
      money("Charge"),
    ),
    note: optionalText(500),
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, {
    path: ["toAccountId"],
    message: "Choose a different account",
  });

export type BalanceTransferInput = z.input<typeof balanceTransferSchema>;

export const voidSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason (at least 3 characters)").max(500),
});
