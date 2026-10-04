// Void List (PLAN.md section 7 "Others"): every voided document (invoices,
// money receipts, vendor payments, advance returns, balance transfers,
// refunds, Hajj transfers) with who voided it, when and why. Filtered by the day it was
// voided (Asia/Dhaka). Raw SQL (UNION ALL) binds agencyId explicitly.
import { Prisma } from "@prisma/client";
import { dateToIso } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { TRANSFER_TYPE_LABEL } from "@/lib/hajj";
import type { VoucherKindKey } from "@/lib/schemas/money";
import { VOUCHER_KIND_INFO } from "@/lib/voucherKinds";
import { INVOICE_TYPE_INFO, invoiceHref, type InvoiceTypeKey } from "@/lib/invoiceTypes";
import type { ReportParams } from "@/lib/reports/params";
import type { ReportResult } from "@/lib/reports/types";
import { REFUND_TYPE_INFO, type RefundTypeKey } from "@/lib/refundTypes";
import { sqlDate } from "@/server/db/sqlDate";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "@/server/services/context";

interface Raw {
  kind: string;
  subtype: string | null;
  id: string;
  number: string;
  date: Date;
  party: string | null;
  amount: Prisma.Decimal;
  reason: string | null;
  voidedAt: Date | null;
  voidedBy: string | null;
}

const KIND_LABEL: Record<string, string> = {
  INVOICE: "Invoice",
  RECEIPT: "Money receipt",
  VENDOR_PAYMENT: "Vendor payment",
  ADVANCE_RETURN: "Advance return",
  TRANSFER: "Balance transfer",
  REFUND: "Refund",
  HAJJ_TRANSFER: "Hajj transfer",
  LOAN: "Loan",
  LOAN_PAYMENT: "Loan payment",
  PAYROLL: "Payroll",
};

const TRANSFER_LIST_PATH: Record<string, string> = {
  MOALLEM: "/hajj/management/moallemtransfers",
  GROUP: "/hajj/management/grouptransfers",
  IN: "/hajj/management/transferin",
  OUT: "/hajj/management/transferout",
};

function href(r: Raw): string | null {
  switch (r.kind) {
    case "INVOICE":
      return invoiceHref(r.subtype ?? "", r.id);
    case "RECEIPT":
      return `/moneyreceipts/${r.id}`;
    case "VOUCHER":
      return VOUCHER_KIND_INFO[r.subtype as VoucherKindKey]?.path ?? null;
    case "LOAN":
      return `/loans/${r.id}`;
    case "LOAN_PAYMENT":
      return "/loans/payments";
    case "PAYROLL":
      return "/payroll";
    case "HAJJ_TRANSFER":
      return TRANSFER_LIST_PATH[r.subtype ?? ""] ?? null;
    case "REFUND":
      return `${REFUND_TYPE_INFO[r.subtype as RefundTypeKey]?.path ?? "/refunds/airticket"}/${r.id}`;
    default:
      return null;
  }
}

export async function voidListReport(
  ctx: ServiceContext,
  p: ReportParams,
  all = false,
): Promise<ReportResult> {
  const db = tenantDb(ctx.agencyId);
  const a = ctx.agencyId;
  const range = [Prisma.sql`TRUE`];
  const day = Prisma.sql`(v."voidedAt" AT TIME ZONE 'Asia/Dhaka')::date`;
  if (p.from) range.push(Prisma.sql`${day} >= ${sqlDate(p.from)}`);
  if (p.to) range.push(Prisma.sql`${day} <= ${sqlDate(p.to)}`);
  const where = Prisma.join(range, " AND ");

  const base = Prisma.sql`
    WITH v AS (
      SELECT 'INVOICE' AS kind, i.type::text AS subtype, i.id, i.number, i.date, c.name AS party,
             i."netTotal" AS amount, i."voidReason" AS reason, i."voidedAt", i."voidedById"
      FROM "Invoice" i JOIN "Client" c ON c.id = i."clientId"
      WHERE i."agencyId" = ${a} AND i.status = 'VOID'
      UNION ALL
      SELECT 'RECEIPT', NULL, r.id, r.number, r.date, c.name, r.amount, r."voidReason", r."voidedAt", r."voidedById"
      FROM "MoneyReceipt" r JOIN "Client" c ON c.id = r."clientId"
      WHERE r."agencyId" = ${a} AND r.status = 'VOID'
      UNION ALL
      SELECT 'VENDOR_PAYMENT', NULL, p.id, p.number, p.date, vd.name, p.amount, p."voidReason", p."voidedAt", p."voidedById"
      FROM "VendorPayment" p JOIN "Vendor" vd ON vd.id = p."vendorId"
      WHERE p."agencyId" = ${a} AND p.status = 'VOID'
      UNION ALL
      SELECT 'ADVANCE_RETURN', ar."partyType"::text, ar.id, ar.number, ar.date,
             COALESCE(c.name, vd.name), ar.amount, ar."voidReason", ar."voidedAt", ar."voidedById"
      FROM "AdvanceReturn" ar
      LEFT JOIN "Client" c ON ar."partyType" = 'CLIENT' AND c.id = ar."partyId"
      LEFT JOIN "Vendor" vd ON ar."partyType" = 'VENDOR' AND vd.id = ar."partyId"
      WHERE ar."agencyId" = ${a} AND ar.status = 'VOID'
      UNION ALL
      SELECT 'TRANSFER', NULL, t.id, t.number, t.date, f.name || ' → ' || tt.name, t.amount,
             t."voidReason", t."voidedAt", t."voidedById"
      FROM "BalanceTransfer" t
      JOIN "MoneyAccount" f ON f.id = t."fromAccountId"
      JOIN "MoneyAccount" tt ON tt.id = t."toAccountId"
      WHERE t."agencyId" = ${a} AND t.status = 'VOID'
      UNION ALL
      SELECT 'REFUND', rf.type::text, rf.id, rf.number, rf.date, c.name,
             rf."clientRefundAmount" - rf."clientCharge", rf."voidReason", rf."voidedAt", rf."voidedById"
      FROM "Refund" rf JOIN "Client" c ON c.id = rf."clientId"
      WHERE rf."agencyId" = ${a} AND rf.status = 'VOID'
      UNION ALL
      SELECT 'HAJJ_TRANSFER', ht.type::text, ht.id, ht.number, ht.date, ht."toLabel", ht."totalCharge",
             ht."voidReason", ht."voidedAt", ht."voidedById"
      FROM "HajjTransfer" ht
      WHERE ht."agencyId" = ${a} AND ht.status = 'VOID'
      UNION ALL
      SELECT 'VOUCHER', vo.kind::text, vo.id, vo.number, vo.date, COALESCE(vo.title, eh.name), vo.amount,
             vo."voidReason", vo."voidedAt", vo."voidedById"
      FROM "Voucher" vo LEFT JOIN "ExpenseHead" eh ON eh.id = vo."expenseHeadId"
      WHERE vo."agencyId" = ${a} AND vo.status = 'VOID'
      UNION ALL
      SELECT 'LOAN', ln.kind::text, ln.id, ln.number, ln.date, la.name, ln.principal,
             ln."voidReason", ln."voidedAt", ln."voidedById"
      FROM "Loan" ln JOIN "LoanAuthority" la ON la.id = ln."authorityId"
      WHERE ln."agencyId" = ${a} AND ln.status = 'VOID'
      UNION ALL
      SELECT 'LOAN_PAYMENT', NULL, lp.id, lp.number, lp.date, la.name, lp.principal + lp.interest,
             lp."voidReason", lp."voidedAt", lp."voidedById"
      FROM "LoanPayment" lp JOIN "Loan" ln ON ln.id = lp."loanId" JOIN "LoanAuthority" la ON la.id = ln."authorityId"
      WHERE lp."agencyId" = ${a} AND lp.status = 'VOID'
      UNION ALL
      SELECT 'PAYROLL', NULL, pr.id, pr.number, pr.date, em.name, pr."netPaid",
             pr."voidReason", pr."voidedAt", pr."voidedById"
      FROM "Payroll" pr JOIN "Employee" em ON em.id = pr."employeeId"
      WHERE pr."agencyId" = ${a} AND pr.status = 'VOID'
    )`;

  const take = all ? 50_000 : p.pageSize;
  const skip = all ? 0 : (p.page - 1) * p.pageSize;
  const [rows, [agg]] = await Promise.all([
    db.$queryRaw<Raw[]>`${base}
      SELECT v.kind, v.subtype, v.id, v.number, v.date, v.party, v.amount, v.reason, v."voidedAt",
             u.name AS "voidedBy"
      FROM v LEFT JOIN "User" u ON u.id = v."voidedById"
      WHERE ${where}
      ORDER BY v."voidedAt" DESC NULLS LAST, v.number
      LIMIT ${take} OFFSET ${skip}`,
    db.$queryRaw<{ n: bigint }[]>`${base} SELECT COUNT(*) AS n FROM v WHERE ${where}`,
  ]);
  const total = Number(agg?.n ?? 0);

  const dhaka = (d: Date | null) =>
    d
      ? d.toLocaleString("en-GB", {
          timeZone: "Asia/Dhaka",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return {
    key: "void-list",
    title: "Void List",
    subtitle:
      p.from || p.to
        ? `Voided ${p.from ? formatDate(p.from) : "any time"} to ${p.to ? formatDate(p.to) : "today"}`
        : "All voided documents",
    columns: [
      { key: "voidedAt", title: "Voided at" },
      { key: "kind", title: "Document" },
      { key: "number", title: "Number", link: true },
      { key: "date", title: "Doc. date", type: "date" },
      { key: "party", title: "Party", width: 2 },
      { key: "amount", title: "Amount", type: "money" },
      { key: "reason", title: "Reason", width: 2.5 },
      { key: "voidedBy", title: "Voided by" },
    ],
    rows: rows.map((r) => ({
      voidedAt: dhaka(r.voidedAt),
      kind:
        r.kind === "INVOICE"
          ? `${INVOICE_TYPE_INFO[r.subtype as InvoiceTypeKey]?.label ?? r.subtype} invoice`
          : r.kind === "VOUCHER"
            ? (VOUCHER_KIND_INFO[r.subtype as VoucherKindKey]?.label ?? "Voucher")
            : r.kind === "HAJJ_TRANSFER"
              ? (TRANSFER_TYPE_LABEL[r.subtype ?? ""] ?? "Hajj transfer")
              : r.kind === "REFUND"
                ? `${REFUND_TYPE_INFO[r.subtype as RefundTypeKey]?.label ?? ""} refund`
                : (KIND_LABEL[r.kind] ?? r.kind),
      number: r.number,
      date: dateToIso(r.date),
      party: r.party,
      amount: new Prisma.Decimal(r.amount).toFixed(2),
      reason: r.reason,
      voidedBy: r.voidedBy,
      _href: href(r),
    })),
    totals: { number: `${total} documents` },
    notes: ["Voided documents stay on record; their ledger entries were reversed, never deleted."],
    paging: all ? undefined : { total, page: p.page, pageSize: p.pageSize },
  };
}
