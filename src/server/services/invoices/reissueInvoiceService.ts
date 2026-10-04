// Reissue invoices (PLAN.md 6.3). Each line points at a ticket the client
// already bought and charges only the change: airline penalty and fare
// difference (payable to the vendor) plus our service charge (profit).
import { Prisma } from "@prisma/client";
import { calcReissueLine } from "@/lib/calc/reissue";
import { dateToIso, isoToDate } from "@/lib/dates";
import { reissueInvoiceSchema } from "@/lib/schemas/invoices";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";
import { createInvoice, updateInvoice, type PreparedLines } from "./invoiceSave";

type Parsed = ReturnType<typeof reissueInvoiceSchema.parse>;
type ParsedLine = Parsed["lines"][number];

const dec = (v: { toFixed(n: number): string }) => new Prisma.Decimal(v.toFixed(2));
const iso = (v: Date | null) => (v ? dateToIso(v) : null);

/** Tickets that can be reissued: on the client's posted, live ticket invoices. */
function reissuableWhere(clientId: string): Prisma.InvoiceAirTicketWhereInput {
  return {
    invoice: {
      clientId,
      type: { in: ["AIR", "NON_COMMISSION"] },
      status: { notIn: ["DRAFT", "VOID", "REFUNDED"] },
    },
  };
}

function prepareReissue(ctx: ServiceContext, clientId: string, lines: ParsedLine[]) {
  return async (tx: TenantTx): Promise<PreparedLines> => {
    const ids = lines.map((l) => l.originalTicketId);
    const vendorIds = [...new Set(lines.map((l) => l.vendorId))];
    const [tickets, vendors, refunded] = await Promise.all([
      tx.invoiceAirTicket.findMany({
        where: { id: { in: ids }, ...reissuableWhere(clientId) },
        select: { id: true, invoiceId: true, passengerName: true, route: true, airlineId: true },
      }),
      tx.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true } }),
      tx.refundLine.findMany({
        where: { lineId: { in: ids }, lineKind: "TICKET", refund: { status: "POSTED" } },
        select: { lineId: true },
      }),
    ]);
    const fieldErrors: Record<string, string> = {};
    lines.forEach((l, i) => {
      if (!tickets.some((t) => t.id === l.originalTicketId))
        fieldErrors[`lines.${i}.originalTicketId`] = "Choose one of this client's tickets";
      else if (refunded.some((r) => r.lineId === l.originalTicketId))
        fieldErrors[`lines.${i}.originalTicketId`] = "This ticket has been refunded";
      if (!vendors.some((v) => v.id === l.vendorId))
        fieldErrors[`lines.${i}.vendorId`] = "Choose a valid vendor";
    });
    if (Object.keys(fieldErrors).length)
      throw new ServiceError("Some lines refer to unknown records", fieldErrors);

    const rows = lines.map((l, i) => {
      const t = tickets.find((x) => x.id === l.originalTicketId)!;
      const r = calcReissueLine(l);
      return {
        sortOrder: i,
        originalTicketId: t.id,
        ticketNo: l.ticketNo ?? null,
        pnr: l.pnr ?? null,
        passengerName: t.passengerName,
        route: t.route,
        airlineId: t.airlineId,
        vendorId: l.vendorId,
        journeyDate: isoToDate(l.journeyDate),
        returnDate: l.returnDate ? isoToDate(l.returnDate) : null,
        penalty: new Prisma.Decimal(l.penalty),
        fareDifference: new Prisma.Decimal(l.fareDifference),
        serviceCharge: new Prisma.Decimal(l.serviceCharge),
        clientPrice: dec(r.clientPrice),
        purchasePrice: dec(r.purchasePrice),
        profit: dec(r.profit),
      };
    });
    // Header link to the original invoice of the first line ("reissue of").
    const reissueOfId = tickets.find((t) => t.id === rows[0]!.originalTicketId)!.invoiceId;
    return {
      totals: rows,
      costs: rows
        .filter((r) => r.purchasePrice.greaterThan(0))
        .map((r) => ({ vendorId: r.vendorId, amount: r.purchasePrice })),
      write: async (t, id) => {
        await t.invoiceReissueLine.createMany({
          data: rows.map((r) => ({ ...r, agencyId: ctx.agencyId, invoiceId: id })),
        });
        await t.invoice.update({ where: { id }, data: { reissueOfId } });
      },
      audit: rows,
    };
  };
}

export async function createReissueInvoice(
  ctx: ServiceContext,
  input: unknown,
): Promise<{ id: string; number: string }> {
  const data = reissueInvoiceSchema.parse(input);
  return createInvoice(ctx, "REISSUE", data, prepareReissue(ctx, data.clientId, data.lines));
}

export async function updateReissueInvoice(
  ctx: ServiceContext,
  id: string,
  input: unknown,
): Promise<void> {
  const data = reissueInvoiceSchema.parse(input);
  await updateInvoice(ctx, "REISSUE", id, data, prepareReissue(ctx, data.clientId, data.lines));
}

export async function postDraftReissueInvoice(ctx: ServiceContext, id: string) {
  const inv = await getReissueInvoice(ctx, id);
  if (!inv) throw new NotFoundError("Invoice");
  if (inv.status !== "DRAFT") throw new ServiceError("Only a draft can be posted");
  await updateReissueInvoice(ctx, id, { ...reissueFormValues(inv), post: true });
}

export async function getReissueInvoice(ctx: ServiceContext, id: string) {
  const inv = await tenantDb(ctx.agencyId).invoice.findFirst({
    where: { id, type: "REISSUE" },
    include: {
      client: {
        select: { id: true, name: true, code: true, phone: true, email: true, address: true },
      },
      agent: { select: { id: true, name: true, code: true } },
      salesman: { select: { id: true, name: true } },
      reissueLines: {
        orderBy: { sortOrder: "asc" },
        include: {
          vendor: { select: { id: true, name: true } },
          airline: { select: { name: true, iata: true } },
          originalTicket: {
            select: {
              ticketNo: true,
              journeyDate: true,
              invoice: { select: { id: true, number: true, type: true } },
            },
          },
        },
      },
      allocations: {
        where: { receipt: { status: "POSTED" } },
        include: { receipt: { select: { id: true, number: true, date: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!inv) return null;
  const money = (v: Prisma.Decimal) => v.toFixed(2);
  return {
    id: inv.id,
    type: inv.type,
    number: inv.number,
    status: inv.status,
    date: dateToIso(inv.date),
    dueDate: iso(inv.dueDate),
    client: inv.client,
    agent: inv.agent,
    salesman: inv.salesman,
    subtotal: money(inv.subtotal),
    discount: money(inv.discount),
    serviceCharge: money(inv.serviceCharge),
    vat: money(inv.vat),
    netTotal: money(inv.netTotal),
    totalCost: money(inv.totalCost),
    agentCommission: money(inv.agentCommission),
    profit: money(inv.profit),
    paidAmount: money(inv.paidAmount),
    refundCredit: money(inv.refundCredit),
    due: money(inv.netTotal.minus(inv.refundCredit).minus(inv.paidAmount)),
    note: inv.note,
    voidReason: inv.voidReason,
    lines: inv.reissueLines.map((l) => ({
      id: l.id,
      originalTicketId: l.originalTicketId,
      originalTicketNo: l.originalTicket.ticketNo,
      originalJourneyDate: dateToIso(l.originalTicket.journeyDate),
      originalInvoice: l.originalTicket.invoice,
      ticketNo: l.ticketNo,
      pnr: l.pnr,
      passengerName: l.passengerName,
      route: l.route,
      airline: l.airline.iata ? `${l.airline.iata} ${l.airline.name}` : l.airline.name,
      vendorId: l.vendorId,
      vendor: l.vendor.name,
      journeyDate: dateToIso(l.journeyDate),
      returnDate: iso(l.returnDate),
      penalty: money(l.penalty),
      fareDifference: money(l.fareDifference),
      serviceCharge: money(l.serviceCharge),
      clientPrice: money(l.clientPrice),
      purchasePrice: money(l.purchasePrice),
      profit: money(l.profit),
    })),
    payments: inv.allocations.map((a) => ({
      receiptId: a.receipt.id,
      number: a.receipt.number,
      date: dateToIso(a.receipt.date),
      amount: money(a.amount),
    })),
  };
}

export type ReissueInvoiceView = NonNullable<Awaited<ReturnType<typeof getReissueInvoice>>>;

export function reissueFormValues(inv: ReissueInvoiceView) {
  return {
    clientId: inv.client.id,
    date: inv.date,
    dueDate: inv.dueDate,
    salesmanId: inv.salesman?.id ?? null,
    agentId: inv.agent?.id ?? null,
    agentCommission: inv.agentCommission,
    discount: inv.discount,
    serviceCharge: inv.serviceCharge,
    vat: inv.vat,
    note: inv.note,
    lines: inv.lines.map((l) => ({
      originalTicketId: l.originalTicketId,
      ticketNo: l.ticketNo,
      pnr: l.pnr,
      vendorId: l.vendorId,
      journeyDate: l.journeyDate,
      returnDate: l.returnDate,
      penalty: l.penalty,
      fareDifference: l.fareDifference,
      serviceCharge: l.serviceCharge,
    })),
  };
}

export interface ReissuableTicket {
  id: string;
  ticketNo: string;
  invoiceNumber: string;
  passengerName: string;
  route: string;
  airline: string;
  vendorId: string;
  journeyDate: string;
  returnDate: string | null;
  pnr: string | null;
}

/** A client's tickets that may be reissued (not refunded), latest journey first. */
export async function reissuableTickets(
  ctx: ServiceContext,
  clientId: string,
): Promise<ReissuableTicket[]> {
  const db = tenantDb(ctx.agencyId);
  const [tickets, refunded] = await Promise.all([
    db.invoiceAirTicket.findMany({
      where: reissuableWhere(clientId),
      orderBy: [{ journeyDate: "desc" }, { ticketNo: "asc" }],
      take: 200,
      include: {
        invoice: { select: { number: true } },
        airline: { select: { name: true, iata: true } },
      },
    }),
    db.refundLine.findMany({
      where: { lineKind: "TICKET", refund: { status: "POSTED", clientId } },
      select: { lineId: true },
    }),
  ]);
  const gone = new Set(refunded.map((r) => r.lineId));
  return tickets
    .filter((t) => !gone.has(t.id))
    .map((t) => ({
      id: t.id,
      ticketNo: t.ticketNo,
      invoiceNumber: t.invoice.number,
      passengerName: t.passengerName,
      route: t.route,
      airline: t.airline.iata ? `${t.airline.iata} ${t.airline.name}` : t.airline.name,
      vendorId: t.vendorId,
      journeyDate: dateToIso(t.journeyDate),
      returnDate: iso(t.returnDate),
      pnr: t.pnr,
    }));
}
