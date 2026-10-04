// Shared by the invoice / receipt / payment forms and their server actions.
import Decimal from "decimal.js";
import { z } from "zod";
import { businessDate } from "@/lib/dates";
import { MONEY_RE, PERCENT_RE } from "@/lib/masters";

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const blankToZero = (v: unknown) => (v === null || v === undefined || v === "" ? "0" : v);
const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.string().trim().max(max).nullable().optional());
const optionalId = z.preprocess(blankToNull, z.string().max(40).nullable().optional());
const optionalDate = (label: string) =>
  z.preprocess(blankToNull, businessDate(label).nullable().optional());

/** Money as a decimal string; never a float. */
export const moneyField = (label: string) =>
  z
    .union([z.string(), z.number()], { error: `${label} is required` })
    .transform((v) => String(v).trim())
    .pipe(z.string().regex(MONEY_RE, `${label} must be an amount with up to 2 decimals`));

const optionalMoney = (label: string) => z.preprocess(blankToZero, moneyField(label));
/** Positive without converting to a float: some digit other than 0. */
const positive = (s: string) => /[1-9]/.test(s);

const percentField = (label: string) =>
  z.preprocess(
    blankToZero,
    z
      .union([z.string(), z.number()])
      .transform((v) => String(v).trim())
      .pipe(
        z
          .string()
          .regex(PERCENT_RE, `${label}: up to 4 decimals`)
          .refine((s) => Number(s) <= 100, `${label} cannot exceed 100`),
      ),
  );

export const PASSENGER_TYPE_OPTIONS = [
  { value: "ADT", label: "Adult" },
  { value: "CHD", label: "Child" },
  { value: "INF", label: "Infant" },
] as const;

export const taxLineSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{1,4}$/, "Tax code: 1 to 4 letters or digits")
    .transform((s) => s.toUpperCase()),
  amount: moneyField("Tax amount"),
});

// Ticket fields shared by air ticket and non commission invoices.
const ticketFields = {
  ticketNo: z
    .string({ error: "Ticket number is required" })
    .trim()
    .regex(/^[A-Za-z0-9-]{3,20}$/, "Ticket number: 3 to 20 letters, digits or dashes")
    .transform((s) => s.toUpperCase()),
  pnr: optionalText(20),
  gdsPnr: optionalText(20),
  gds: optionalText(30),
  airlineId: z.string({ error: "Choose the airline" }).min(1, "Choose the airline"),
  vendorId: z.string({ error: "Choose the vendor" }).min(1, "Choose the vendor"),
  passengerName: z
    .string({ error: "Passenger name is required" })
    .trim()
    .min(2, "Passenger name is required")
    .max(120),
  passengerType: z.enum(["ADT", "CHD", "INF"]).default("ADT"),
  passportNo: optionalText(20),
  route: z
    .string({ error: "Route is required" })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}(-[A-Z]{3})+$/, "Route: airport codes like DAC-DXB-DAC"),
  journeyDate: businessDate("Journey date"),
  returnDate: optionalDate("Return date"),
  cabinClass: optionalText(20),
  taxes: z.array(taxLineSchema).max(20).default([]),
  clientPrice: moneyField("Client price").refine(positive, "Client price must be more than 0"),
};

const returnAfterJourney = {
  check: (t: { returnDate?: string | null; journeyDate: string }) =>
    !t.returnDate || t.returnDate >= t.journeyDate,
  issue: { path: ["returnDate"], message: "Return date is before the journey date" },
};

export const airTicketLineSchema = z
  .object({
    ...ticketFields,
    baseFare: moneyField("Base fare").refine(positive, "Base fare must be more than 0"),
    commissionPercent: percentField("Commission %"),
  })
  .refine(returnAfterJourney.check, returnAfterJourney.issue);

export type AirTicketLineInput = z.input<typeof airTicketLineSchema>;

/** Non commission ticket (PLAN.md 6.2): no commission / AIT; purchase price entered directly. */
export const nonCommissionTicketSchema = z
  .object({
    ...ticketFields,
    baseFare: optionalMoney("Base fare"),
    purchasePrice: moneyField("Purchase price"),
  })
  .refine(returnAfterJourney.check, returnAfterJourney.issue);

// ─── Invoice header shared by every invoice type ─────────────────────────────

export const invoiceHeaderFields = {
  clientId: z.string({ error: "Choose a client" }).min(1, "Choose a client"),
  date: businessDate("Invoice date"),
  dueDate: optionalDate("Due date"),
  salesmanId: optionalId,
  agentId: optionalId,
  agentCommission: optionalMoney("Agent commission"),
  discount: optionalMoney("Discount"),
  serviceCharge: optionalMoney("Service charge"),
  vat: optionalMoney("VAT"),
  note: optionalText(1000),
  /** Tour / Umrah / Hajj details. */
  tourGroupId: optionalId,
  groupId: optionalId,
  travelDate: optionalDate("Travel date"),
  returnDate: optionalDate("Return date"),
  /** true = post to the ledger now; false = save as draft. */
  post: z.boolean().default(true),
};

type HeaderValues = {
  date: string;
  dueDate?: string | null;
  agentId?: string | null;
  agentCommission: string;
  travelDate?: string | null;
  returnDate?: string | null;
};

function headerChecks(v: HeaderValues, ctx: z.RefinementCtx) {
  if (v.dueDate && v.dueDate < v.date) {
    ctx.addIssue({
      code: "custom",
      path: ["dueDate"],
      message: "Due date is before the invoice date",
    });
  }
  if (positive(v.agentCommission) && !v.agentId) {
    ctx.addIssue({
      code: "custom",
      path: ["agentId"],
      message: "Choose the agent who earns this commission",
    });
  }
  if (v.travelDate && v.returnDate && v.returnDate < v.travelDate) {
    ctx.addIssue({
      code: "custom",
      path: ["returnDate"],
      message: "Return date is before the travel date",
    });
  }
}

function uniqueTickets(v: { tickets: { ticketNo: string }[] }, ctx: z.RefinementCtx) {
  const seen = new Map<string, number>();
  v.tickets.forEach((t, i) => {
    const prev = seen.get(t.ticketNo);
    if (prev !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["tickets", i, "ticketNo"],
        message: `Same ticket number as ticket ${prev + 1}`,
      });
    }
    seen.set(t.ticketNo, i);
  });
}

export const airInvoiceSchema = z
  .object({
    ...invoiceHeaderFields,
    tickets: z.array(airTicketLineSchema).min(1, "Add at least one ticket").max(50),
  })
  .superRefine((v, ctx) => {
    headerChecks(v, ctx);
    uniqueTickets(v, ctx);
  });

export type AirInvoiceInput = z.input<typeof airInvoiceSchema>;

export const nonCommissionInvoiceSchema = z
  .object({
    ...invoiceHeaderFields,
    tickets: z.array(nonCommissionTicketSchema).min(1, "Add at least one ticket").max(50),
  })
  .superRefine((v, ctx) => {
    headerChecks(v, ctx);
    uniqueTickets(v, ctx);
  });

// ─── Item based invoices: Other, Other Package, Tour, Umrah ─────────────────

export const ITEM_KINDS = [
  "SERVICE",
  "PACKAGE",
  "ACCOMMODATION",
  "TRANSPORT",
  "OTHER_TRANSPORT",
  "GUIDE",
  "FOOD",
  "PLACE",
  "TOUR_TICKET",
  "PILGRIM",
] as const;

const QTY_RE = /^\d{1,6}(\.\d{1,2})?$/;

export const invoiceItemSchema = z
  .object({
    kind: z.enum(ITEM_KINDS).default("SERVICE"),
    productId: optionalId,
    sourceId: optionalId,
    description: z
      .string({ error: "Description is required" })
      .trim()
      .min(1, "Description is required")
      .max(300),
    qty: z
      .union([z.string(), z.number()], { error: "Quantity is required" })
      .transform((v) => String(v).trim())
      .pipe(
        z
          .string()
          .regex(QTY_RE, "Quantity: up to 2 decimals")
          .refine(positive, "Quantity must be more than 0"),
      ),
    unitPrice: optionalMoney("Unit price"),
    unitCost: optionalMoney("Unit cost"),
    vendorId: optionalId,
    passengerName: optionalText(120),
    passportNo: optionalText(20),
    groupId: optionalId,
    roomTypeId: optionalId,
    serviceDate: optionalDate("Date"),
    /** Hajj lines: the pilgrim record (name and passport come from it). */
    pilgrimId: optionalId,
  })
  .superRefine((it, ctx) => {
    if (positive(it.unitCost) && !it.vendorId) {
      ctx.addIssue({
        code: "custom",
        path: ["vendorId"],
        message: "Choose the vendor this cost is payable to",
      });
    }
    if (!positive(it.unitCost) && !positive(it.unitPrice)) {
      ctx.addIssue({
        code: "custom",
        path: ["unitPrice"],
        message: "Enter a price, a cost, or both",
      });
    }
    if (it.kind === "PILGRIM" && !it.passengerName && !it.pilgrimId) {
      ctx.addIssue({
        code: "custom",
        path: ["passengerName"],
        message: "Passenger name is required",
      });
    }
  });

export const itemInvoiceSchema = z
  .object({
    ...invoiceHeaderFields,
    items: z.array(invoiceItemSchema).min(1, "Add at least one line").max(200),
  })
  .superRefine((v, ctx) => headerChecks(v, ctx));

export type ItemInvoiceInput = z.input<typeof itemInvoiceSchema>;

// ─── Visa (PLAN.md 6.4) ──────────────────────────────────────────────────────

export const VISA_STATUSES = ["PENDING", "SUBMITTED", "APPROVED", "REJECTED", "DELIVERED"] as const;

export const visaLineSchema = z.object({
  /** Existing line id when editing, so its processing status is kept. */
  id: optionalId,
  country: z.string({ error: "Country is required" }).trim().min(2, "Country is required").max(80),
  visaTypeId: optionalId,
  passengerName: z
    .string({ error: "Passenger name is required" })
    .trim()
    .min(2, "Passenger name is required")
    .max(120),
  passportNo: optionalText(20),
  vendorId: z.string({ error: "Choose the vendor" }).min(1, "Choose the vendor"),
  clientPrice: moneyField("Client price").refine(positive, "Client price must be more than 0"),
  purchasePrice: moneyField("Cost"),
  expectedDate: optionalDate("Expected date"),
  note: optionalText(300),
});

export const visaInvoiceSchema = z
  .object({
    ...invoiceHeaderFields,
    lines: z.array(visaLineSchema).min(1, "Add at least one passenger").max(100),
  })
  .superRefine((v, ctx) => headerChecks(v, ctx));

export type VisaInvoiceInput = z.input<typeof visaInvoiceSchema>;

export const visaStatusSchema = z.object({
  status: z.enum(VISA_STATUSES),
  note: optionalText(300),
  deliveryDate: optionalDate("Delivery date"),
});

// ─── Reissue (PLAN.md 6.3) ──────────────────────────────────────────────────

export const reissueLineSchema = z
  .object({
    originalTicketId: z.string({ error: "Choose the ticket" }).min(1, "Choose the ticket"),
    ticketNo: z.preprocess(
      blankToNull,
      z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9-]{3,20}$/, "Ticket number: 3 to 20 letters, digits or dashes")
        .transform((s) => s.toUpperCase())
        .nullable()
        .optional(),
    ),
    pnr: optionalText(20),
    vendorId: z.string({ error: "Choose the vendor" }).min(1, "Choose the vendor"),
    journeyDate: businessDate("New journey date"),
    returnDate: optionalDate("New return date"),
    penalty: optionalMoney("Penalty"),
    fareDifference: optionalMoney("Fare difference"),
    serviceCharge: optionalMoney("Service charge"),
  })
  .refine(returnAfterJourney.check, returnAfterJourney.issue)
  .refine((l) => positive(l.penalty) || positive(l.fareDifference) || positive(l.serviceCharge), {
    path: ["penalty"],
    message: "Enter the penalty, fare difference or service charge",
  });

export const reissueInvoiceSchema = z
  .object({
    ...invoiceHeaderFields,
    lines: z.array(reissueLineSchema).min(1, "Add at least one ticket").max(50),
  })
  .superRefine((v, ctx) => {
    headerChecks(v, ctx);
    const seen = new Set<string>();
    v.lines.forEach((l, i) => {
      if (seen.has(l.originalTicketId))
        ctx.addIssue({
          code: "custom",
          path: ["lines", i, "originalTicketId"],
          message: "This ticket is already on the reissue",
        });
      seen.add(l.originalTicketId);
    });
  });

export type ReissueInvoiceInput = z.input<typeof reissueInvoiceSchema>;

// ─── Refund (PLAN.md 6.7) ───────────────────────────────────────────────────

export const REFUND_TYPES = ["AIR", "OTHER", "TOUR", "PARTIAL", "OTHER_PACKAGE_HAJJ"] as const;
export const REFUND_METHODS = ["ADJUST_TO_BALANCE", "CASH_RETURN"] as const;

export const refundLineSchema = z.object({
  lineId: z.string().min(1),
  clientAmount: optionalMoney("Client amount"),
  vendorAmount: optionalMoney("Vendor amount"),
  vendorCharge: optionalMoney("Vendor charge"),
});

export const refundSchema = z
  .object({
    invoiceId: z.string({ error: "Choose the invoice" }).min(1, "Choose the invoice"),
    date: businessDate("Refund date"),
    clientCharge: optionalMoney("Client charge"),
    method: z.enum(REFUND_METHODS, { error: "Choose how the client gets the money" }),
    returnAmount: optionalMoney("Amount paid back"),
    moneyAccountId: optionalId,
    note: optionalText(500),
    lines: z.array(refundLineSchema).min(1, "Choose at least one line to refund").max(100),
  })
  .superRefine((v, ctx) => {
    if (v.method === "CASH_RETURN") {
      if (!v.moneyAccountId)
        ctx.addIssue({ code: "custom", path: ["moneyAccountId"], message: "Choose the account" });
      if (!positive(v.returnAmount))
        ctx.addIssue({ code: "custom", path: ["returnAmount"], message: "Enter the amount" });
    }
  });

export type RefundInput = z.input<typeof refundSchema>;

export const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "BANK", label: "Bank transfer / deposit" },
  { value: "MOBILE", label: "Mobile banking (bKash, Nagad, ...)" },
  { value: "CARD", label: "Card" },
  { value: "CHEQUE", label: "Cheque" },
] as const;

const paymentMethod = z.enum(["CASH", "BANK", "MOBILE", "CARD", "CHEQUE"], {
  error: "Choose how it was paid",
});

/** Cheque details, required when the method is Cheque (PLAN.md 6.10). */
export const chequeDetailsSchema = z.object({
  chequeNo: z
    .string({ error: "Cheque number is required" })
    .trim()
    .min(1, "Cheque number is required")
    .max(30),
  bankName: z.string({ error: "Bank is required" }).trim().min(2, "Bank is required").max(80),
  chequeDate: businessDate("Cheque date"),
});

function chequeChecks(
  v: { paymentMethod: string; cheque?: unknown; transactionCharge: string },
  ctx: z.RefinementCtx,
) {
  if (v.paymentMethod !== "CHEQUE") return;
  if (!v.cheque)
    ctx.addIssue({
      code: "custom",
      path: ["cheque", "chequeNo"],
      message: "Enter the cheque details",
    });
  if (positive(v.transactionCharge))
    ctx.addIssue({
      code: "custom",
      path: ["transactionCharge"],
      message: "No transaction charge on cheques; the bank charge is booked when it clears",
    });
}

export const moneyReceiptSchema = z
  .object({
    clientId: z.string({ error: "Choose a client" }).min(1, "Choose a client"),
    date: businessDate("Date"),
    moneyAccountId: z
      .string({ error: "Choose the account the money went into" })
      .min(1, "Choose the account"),
    paymentMethod,
    amount: moneyField("Amount").refine(positive, "Amount must be more than 0"),
    transactionCharge: optionalMoney("Transaction charge"),
    reference: optionalText(80),
    note: optionalText(500),
    cheque: chequeDetailsSchema.nullable().optional(),
    /** Omitted = allocate automatically, oldest invoice first. */
    allocations: z
      .array(z.object({ invoiceId: z.string().min(1), amount: moneyField("Allocation") }))
      .max(200)
      .optional(),
  })
  .refine((v) => new Decimal(v.transactionCharge).lessThan(v.amount), {
    path: ["transactionCharge"],
    message: "Charge must be less than the amount",
  })
  .superRefine(chequeChecks);

export type MoneyReceiptInput = z.input<typeof moneyReceiptSchema>;

export const vendorPaymentSchema = z
  .object({
    vendorId: z.string({ error: "Choose a vendor" }).min(1, "Choose a vendor"),
    date: businessDate("Date"),
    moneyAccountId: z
      .string({ error: "Choose the account paid from" })
      .min(1, "Choose the account"),
    paymentMethod,
    amount: moneyField("Amount").refine(positive, "Amount must be more than 0"),
    transactionCharge: optionalMoney("Transaction charge"),
    reference: optionalText(80),
    note: optionalText(500),
    cheque: chequeDetailsSchema.nullable().optional(),
  })
  .superRefine(chequeChecks);

export type VendorPaymentInput = z.input<typeof vendorPaymentSchema>;

export const advanceReturnSchema = z.object({
  partyId: z.string({ error: "Choose who the advance belongs to" }).min(1, "Choose a party"),
  date: businessDate("Date"),
  moneyAccountId: z.string({ error: "Choose the account" }).min(1, "Choose the account"),
  amount: moneyField("Amount").refine(positive, "Amount must be more than 0"),
  note: optionalText(500),
});

export type AdvanceReturnInput = z.input<typeof advanceReturnSchema>;
