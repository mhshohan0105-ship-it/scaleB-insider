// Sales Report (PLAN.md section 7 "Sales"): posted invoices in a period with
// sales, refunds, cost, profit, received and due. Filters: client, salesman,
// airline. Refunds are shown against their invoice (by invoice date); cost and
// profit are net of them.
import { Prisma } from "@prisma/client";
import { dateToIso, isoToDate } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import type { ReportParams } from "@/lib/reports/params";
import type { ReportResult } from "@/lib/reports/types";
import { INVOICE_TYPE_INFO, invoiceHref, type InvoiceTypeKey } from "@/lib/invoiceTypes";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "@/server/services/context";

export async function salesReport(
  ctx: ServiceContext,
  p: ReportParams,
  all = false,
): Promise<ReportResult> {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.InvoiceWhereInput = {
    status: { in: ["POSTED", "PARTIAL", "PAID", "REFUNDED"] },
  };
  if (p.from || p.to) {
    where.date = {
      ...(p.from ? { gte: isoToDate(p.from) } : {}),
      ...(p.to ? { lte: isoToDate(p.to) } : {}),
    };
  }
  if (p.clientId) where.clientId = p.clientId;
  if (p.salesmanId) where.salesmanId = p.salesmanId;
  if (p.airlineId) where.airTickets = { some: { airlineId: p.airlineId } };

  const take = all ? 50_000 : p.pageSize;
  const skip = all ? 0 : (p.page - 1) * p.pageSize;
  const [rows, total, sums] = await Promise.all([
    db.invoice.findMany({
      where,
      include: {
        client: { select: { name: true, code: true } },
        salesman: { select: { name: true } },
        _count: {
          select: { airTickets: true, items: true, visaLines: true, reissueLines: true },
        },
      },
      orderBy: [{ date: "asc" }, { number: "asc" }],
      skip,
      take,
    }),
    db.invoice.count({ where }),
    db.invoice.aggregate({
      where,
      _sum: {
        netTotal: true,
        totalCost: true,
        profit: true,
        paidAmount: true,
        discount: true,
        refundCredit: true,
        refundCost: true,
      },
    }),
  ]);
  const s = sums._sum;
  const z = new Prisma.Decimal(0);
  const net = s.netTotal ?? z;
  const paid = s.paidAmount ?? z;
  const refunded = s.refundCredit ?? z;
  const cost = (s.totalCost ?? z).minus(s.refundCost ?? z);
  const profit = (s.profit ?? z).minus(refunded).plus(s.refundCost ?? z);
  const due = net.minus(refunded).minus(paid);
  const money = (v: Prisma.Decimal) => v.toFixed(2);

  const subtitle = [
    p.from || p.to
      ? `${p.from ? formatDate(p.from) : "Start"} to ${p.to ? formatDate(p.to) : "today"}`
      : "All dates",
  ].join(" · ");

  return {
    key: "sales",
    title: "Sales Report",
    subtitle,
    columns: [
      { key: "date", title: "Date", type: "date" },
      { key: "invoice", title: "Invoice", link: true },
      { key: "type", title: "Type" },
      { key: "client", title: "Client", width: 2 },
      { key: "salesman", title: "Sold by" },
      { key: "items", title: "Items", type: "number" },
      { key: "sales", title: "Sales", type: "money" },
      { key: "refunded", title: "Refunded", type: "money" },
      { key: "cost", title: "Cost", type: "money" },
      { key: "profit", title: "Profit", type: "money" },
      { key: "received", title: "Received", type: "money" },
      { key: "due", title: "Due", type: "money" },
    ],
    rows: rows.map((r) => ({
      date: dateToIso(r.date),
      invoice: r.number,
      type: INVOICE_TYPE_INFO[r.type as InvoiceTypeKey]?.label ?? r.type,
      client: `${r.client.name} (${r.client.code})`,
      salesman: r.salesman?.name ?? null,
      items: r._count.airTickets + r._count.items + r._count.visaLines + r._count.reissueLines,
      sales: money(r.netTotal),
      refunded: money(r.refundCredit),
      cost: money(r.totalCost.minus(r.refundCost)),
      profit: money(r.profit.minus(r.refundCredit).plus(r.refundCost)),
      received: money(r.paidAmount),
      due: money(r.netTotal.minus(r.refundCredit).minus(r.paidAmount)),
      _href: invoiceHref(r.type, r.id),
    })),
    totals: {
      invoice: `${total} invoices`,
      sales: money(net),
      refunded: money(refunded),
      cost: money(cost),
      profit: money(profit),
      received: money(paid),
      due: money(due),
    },
    summary: [
      { label: "Sales", value: money(net) },
      { label: "Refunded", value: money(refunded) },
      {
        label: "Profit",
        value: money(profit),
        tone: profit.isNegative() ? "bad" : "good",
      },
      { label: "Received", value: money(paid) },
      { label: "Due", value: money(due) },
      { label: "Discount given", value: money(s.discount ?? z) },
    ],
    paging: all ? undefined : { total, page: p.page, pageSize: p.pageSize },
  };
}
