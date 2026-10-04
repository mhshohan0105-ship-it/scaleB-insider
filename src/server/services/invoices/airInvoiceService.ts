// Ticket invoices: Air ticket (PLAN.md 6.1) and Non commission (6.2). One
// invoice, many tickets, each with its own vendor. Air prices come from
// calcAirTicket() so the form preview and the posted figures always agree;
// non commission tickets take the purchase price as entered.
import { Prisma } from "@prisma/client";
import { calcAirTicket, type FareBase } from "@/lib/calc/airTicket";
import { d, round2, sum } from "@/lib/calc/money";
import { dateToIso, isoToDate } from "@/lib/dates";
import { airInvoiceSchema, nonCommissionInvoiceSchema } from "@/lib/schemas/invoices";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";
import { createInvoice, updateInvoice, type PreparedLines } from "./invoiceSave";

export type TicketInvoiceType = "AIR" | "NON_COMMISSION";

type AirParsed = ReturnType<typeof airInvoiceSchema.parse>;
type NonCommissionParsed = ReturnType<typeof nonCommissionInvoiceSchema.parse>;
type ParsedTicket = AirParsed["tickets"][number] | NonCommissionParsed["tickets"][number];

export interface AirPricingSettings {
  aitRatePercent: string;
  aitBase: FareBase;
  commissionBase: FareBase;
  /** Per airline commission base overrides and default commission %. */
  airlines: Record<string, { commissionBase: FareBase | null; commissionPercent: string | null }>;
}

/** App Config + airline overrides used by calcAirTicket (also sent to the form). */
export async function airPricingSettings(
  db: TenantTx | ReturnType<typeof tenantDb>,
): Promise<AirPricingSettings> {
  const [setting, airlines] = await Promise.all([
    db.agencySetting.findFirst(),
    db.airline.findMany({ select: { id: true, commissionBase: true, commissionPercent: true } }),
  ]);
  return {
    aitRatePercent: (setting?.aitRatePercent ?? new Prisma.Decimal("0.3")).toString(),
    aitBase: setting?.aitBase ?? "TOTAL_FARE",
    commissionBase: setting?.commissionBase ?? "BASE_FARE",
    airlines: Object.fromEntries(
      airlines.map((a) => [
        a.id,
        {
          commissionBase: a.commissionBase,
          commissionPercent: a.commissionPercent?.toString() ?? null,
        },
      ]),
    ),
  };
}

const dec = (v: { toFixed(n: number): string }) => new Prisma.Decimal(v.toFixed(2));

function priceTicket(t: ParsedTicket, settings: AirPricingSettings | null) {
  if ("commissionPercent" in t && settings) {
    const r = calcAirTicket({
      baseFare: t.baseFare,
      taxes: t.taxes,
      commissionPercent: t.commissionPercent,
      commissionBase: settings.airlines[t.airlineId]?.commissionBase ?? settings.commissionBase,
      aitRatePercent: settings.aitRatePercent,
      aitBase: settings.aitBase,
      clientPrice: t.clientPrice,
    });
    return {
      commissionPercent: new Prisma.Decimal(t.commissionPercent),
      taxTotal: dec(r.taxTotal),
      totalFare: dec(r.totalFare),
      commissionAmount: dec(r.commissionAmount),
      aitAmount: dec(r.aitAmount),
      purchasePrice: dec(r.purchasePrice),
      profit: dec(r.profit),
    };
  }
  // Non commission: fares are for information; purchase price is as entered.
  const purchase = "purchasePrice" in t ? d(t.purchasePrice) : d(0);
  const taxTotal = round2(sum(t.taxes.map((x) => d(x.amount))));
  return {
    commissionPercent: new Prisma.Decimal(0),
    taxTotal: dec(taxTotal),
    totalFare: dec(d(t.baseFare).plus(taxTotal)),
    commissionAmount: new Prisma.Decimal(0),
    aitAmount: new Prisma.Decimal(0),
    purchasePrice: dec(purchase),
    profit: dec(d(t.clientPrice).minus(purchase)),
  };
}

function ticketRows(tickets: ParsedTicket[], settings: AirPricingSettings | null) {
  return tickets.map((t, i) => ({
    sortOrder: i,
    ticketNo: t.ticketNo,
    pnr: t.pnr ?? null,
    gdsPnr: t.gdsPnr ?? null,
    gds: t.gds ?? null,
    airlineId: t.airlineId,
    vendorId: t.vendorId,
    passengerName: t.passengerName,
    passengerType: t.passengerType,
    passportNo: t.passportNo ?? null,
    route: t.route,
    segmentCount: t.route.split("-").length - 1,
    journeyDate: isoToDate(t.journeyDate),
    returnDate: t.returnDate ? isoToDate(t.returnDate) : null,
    cabinClass: t.cabinClass ?? null,
    baseFare: new Prisma.Decimal(t.baseFare),
    taxes: t.taxes,
    clientPrice: new Prisma.Decimal(t.clientPrice),
    ...priceTicket(t, settings),
  }));
}

async function assertTicketRefs(tx: TenantTx, tickets: ParsedTicket[]) {
  const airlineIds = [...new Set(tickets.map((t) => t.airlineId))];
  const vendorIds = [...new Set(tickets.map((t) => t.vendorId))];
  const [airlines, vendors] = await Promise.all([
    tx.airline.findMany({ where: { id: { in: airlineIds } }, select: { id: true } }),
    tx.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true } }),
  ]);
  const fieldErrors: Record<string, string> = {};
  tickets.forEach((t, i) => {
    if (!airlines.some((a) => a.id === t.airlineId))
      fieldErrors[`tickets.${i}.airlineId`] = "Choose a valid airline";
    if (!vendors.some((v) => v.id === t.vendorId))
      fieldErrors[`tickets.${i}.vendorId`] = "Choose a valid vendor";
  });
  if (Object.keys(fieldErrors).length) {
    throw new ServiceError("Some tickets refer to unknown records", fieldErrors);
  }
}

/** A ticket number may appear on only one live (non void) invoice per agency. */
async function assertUniqueTickets(
  tx: TenantTx,
  tickets: ParsedTicket[],
  invoiceId: string | null,
) {
  const clashes = await tx.invoiceAirTicket.findMany({
    where: {
      ticketNo: { in: tickets.map((t) => t.ticketNo) },
      invoice: { status: { not: "VOID" }, ...(invoiceId ? { id: { not: invoiceId } } : {}) },
    },
    select: { ticketNo: true, invoice: { select: { number: true } } },
  });
  if (clashes.length) {
    const fieldErrors: Record<string, string> = {};
    tickets.forEach((t, i) => {
      const c = clashes.find((x) => x.ticketNo === t.ticketNo);
      if (c) fieldErrors[`tickets.${i}.ticketNo`] = `Already on invoice ${c.invoice.number}`;
    });
    throw new ServiceError(
      `Ticket ${clashes.map((c) => c.ticketNo).join(", ")} is already on another invoice`,
      fieldErrors,
    );
  }
}

function prepareTickets(ctx: ServiceContext, type: TicketInvoiceType, tickets: ParsedTicket[]) {
  return async (tx: TenantTx, invoiceId: string | null): Promise<PreparedLines> => {
    await assertTicketRefs(tx, tickets);
    await assertUniqueTickets(tx, tickets, invoiceId);
    const rows = ticketRows(tickets, type === "AIR" ? await airPricingSettings(tx) : null);
    return {
      totals: rows,
      costs: rows.map((r) => ({ vendorId: r.vendorId, amount: r.purchasePrice })),
      write: async (t, id) => {
        await t.invoiceAirTicket.createMany({
          data: rows.map((r) => ({ ...r, agencyId: ctx.agencyId, invoiceId: id })),
        });
      },
      audit: rows,
    };
  };
}

function parse(type: TicketInvoiceType, input: unknown) {
  return type === "AIR" ? airInvoiceSchema.parse(input) : nonCommissionInvoiceSchema.parse(input);
}

export async function createAirInvoice(
  ctx: ServiceContext,
  input: unknown,
  type: TicketInvoiceType = "AIR",
): Promise<{ id: string; number: string }> {
  const data = parse(type, input);
  return createInvoice(ctx, type, data, prepareTickets(ctx, type, data.tickets));
}

export async function updateAirInvoice(
  ctx: ServiceContext,
  id: string,
  input: unknown,
  type: TicketInvoiceType = "AIR",
): Promise<void> {
  const data = parse(type, input);
  await updateInvoice(ctx, type, id, data, prepareTickets(ctx, type, data.tickets));
}

/** Posts a draft ticket invoice as it stands. */
export async function postDraftAirInvoice(
  ctx: ServiceContext,
  id: string,
  type: TicketInvoiceType = "AIR",
): Promise<void> {
  const inv = await getAirInvoice(ctx, id, type);
  if (!inv) throw new NotFoundError("Invoice");
  if (inv.status !== "DRAFT") throw new ServiceError("Only a draft can be posted");
  await updateAirInvoice(ctx, id, { ...toFormValues(inv), post: true }, type);
}

export type AirInvoiceView = NonNullable<Awaited<ReturnType<typeof getAirInvoice>>>;

export async function getAirInvoice(
  ctx: ServiceContext,
  id: string,
  type: TicketInvoiceType = "AIR",
) {
  const inv = await tenantDb(ctx.agencyId).invoice.findFirst({
    where: { id, type },
    include: {
      client: {
        select: { id: true, name: true, code: true, phone: true, email: true, address: true },
      },
      agent: { select: { id: true, name: true, code: true } },
      salesman: { select: { id: true, name: true } },
      airTickets: {
        orderBy: { sortOrder: "asc" },
        include: {
          airline: { select: { iata: true, name: true } },
          vendor: { select: { id: true, name: true, code: true } },
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
    type: inv.type as TicketInvoiceType,
    number: inv.number,
    status: inv.status,
    date: dateToIso(inv.date),
    dueDate: inv.dueDate ? dateToIso(inv.dueDate) : null,
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
    tickets: inv.airTickets.map((t) => ({
      id: t.id,
      ticketNo: t.ticketNo,
      pnr: t.pnr,
      gdsPnr: t.gdsPnr,
      gds: t.gds,
      airlineId: t.airlineId,
      airline: `${t.airline.iata} · ${t.airline.name}`,
      vendorId: t.vendorId,
      vendor: t.vendor.name,
      passengerName: t.passengerName,
      passengerType: t.passengerType,
      passportNo: t.passportNo,
      route: t.route,
      journeyDate: dateToIso(t.journeyDate),
      returnDate: t.returnDate ? dateToIso(t.returnDate) : null,
      cabinClass: t.cabinClass,
      baseFare: money(t.baseFare),
      taxes: (t.taxes as { code: string; amount: string }[]) ?? [],
      taxTotal: money(t.taxTotal),
      totalFare: money(t.totalFare),
      commissionPercent: t.commissionPercent.toString(),
      commissionAmount: money(t.commissionAmount),
      aitAmount: money(t.aitAmount),
      clientPrice: money(t.clientPrice),
      purchasePrice: money(t.purchasePrice),
      profit: money(t.profit),
    })),
    payments: inv.allocations.map((a) => ({
      receiptId: a.receipt.id,
      number: a.receipt.number,
      date: dateToIso(a.receipt.date),
      amount: money(a.amount),
    })),
  };
}

/** Form values for editing an existing invoice. */
export function toFormValues(inv: AirInvoiceView) {
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
    tickets: inv.tickets.map((t) => ({
      ticketNo: t.ticketNo,
      pnr: t.pnr,
      gdsPnr: t.gdsPnr,
      gds: t.gds,
      airlineId: t.airlineId,
      vendorId: t.vendorId,
      passengerName: t.passengerName,
      passengerType: t.passengerType,
      passportNo: t.passportNo,
      route: t.route,
      journeyDate: t.journeyDate,
      returnDate: t.returnDate,
      cabinClass: t.cabinClass,
      baseFare: t.baseFare,
      taxes: t.taxes,
      commissionPercent: t.commissionPercent,
      clientPrice: t.clientPrice,
      ...(inv.type === "NON_COMMISSION" ? { purchasePrice: t.purchasePrice } : {}),
    })),
  };
}
