// Line based invoices (PLAN.md 6.5): Other, Other Package, Tour Package,
// Umrah, Hajj pre registration and Hajj. Every line has a client side (qty x unit price) and a cost side
// (qty x unit cost, payable to its vendor).
import { Prisma, type InvoiceType } from "@prisma/client";
import { calcItemLine } from "@/lib/calc/items";
import { dateToIso, isoToDate } from "@/lib/dates";
import { isActive } from "@/lib/hajj";
import { itemInvoiceSchema } from "@/lib/schemas/invoices";
import type { TenantTx } from "@/server/db/tenant";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";
import { createInvoice, updateInvoice, type PreparedLines } from "./invoiceSave";

export const ITEM_INVOICE_TYPES = [
  "OTHER",
  "OTHER_PACKAGE",
  "TOUR",
  "UMRAH",
  "HAJJ_PRE_REG",
  "HAJJ",
] as const;

/** Invoice types whose every line is one pilgrim record (PLAN.md 6.5). */
export const PILGRIM_INVOICE_TYPES = ["HAJJ_PRE_REG", "HAJJ"] as const;
export function isPilgrimInvoiceType(t: string): boolean {
  return (PILGRIM_INVOICE_TYPES as readonly string[]).includes(t);
}
export type ItemInvoiceType = (typeof ITEM_INVOICE_TYPES)[number];

export function isItemInvoiceType(t: string): t is ItemInvoiceType {
  return (ITEM_INVOICE_TYPES as readonly string[]).includes(t);
}

type Parsed = ReturnType<typeof itemInvoiceSchema.parse>;
type ParsedItem = Parsed["items"][number];

const dec = (v: { toFixed(n: number): string }) => new Prisma.Decimal(v.toFixed(2));

async function assertItemRefs(tx: TenantTx, items: ParsedItem[]) {
  const ids = (k: keyof ParsedItem) => [
    ...new Set(items.map((i) => i[k]).filter((x): x is string => typeof x === "string" && !!x)),
  ];
  const [vendors, products, groups, rooms] = await Promise.all([
    tx.vendor.findMany({ where: { id: { in: ids("vendorId") } }, select: { id: true } }),
    tx.product.findMany({ where: { id: { in: ids("productId") } }, select: { id: true } }),
    tx.group.findMany({ where: { id: { in: ids("groupId") } }, select: { id: true } }),
    tx.roomType.findMany({ where: { id: { in: ids("roomTypeId") } }, select: { id: true } }),
  ]);
  const has = (list: { id: string }[], id?: string | null) => !id || list.some((x) => x.id === id);
  const fieldErrors: Record<string, string> = {};
  items.forEach((it, i) => {
    if (!has(vendors, it.vendorId)) fieldErrors[`items.${i}.vendorId`] = "Choose a valid vendor";
    if (!has(products, it.productId))
      fieldErrors[`items.${i}.productId`] = "Choose a valid product";
    if (!has(groups, it.groupId)) fieldErrors[`items.${i}.groupId`] = "Choose a valid group";
    if (!has(rooms, it.roomTypeId))
      fieldErrors[`items.${i}.roomTypeId`] = "Choose a valid room type";
  });
  if (Object.keys(fieldErrors).length)
    throw new ServiceError("Some lines refer to unknown records", fieldErrors);
}

/**
 * Hajj lines: every line names a pilgrim (once per invoice). Name, passport
 * and group come from the pilgrim record. Pilgrims already on this invoice may
 * stay even if cancelled since; new ones must be active.
 */
async function withPilgrims(
  tx: TenantTx,
  type: ItemInvoiceType,
  items: ParsedItem[],
  invoiceId: string | null,
): Promise<ParsedItem[]> {
  if (!isPilgrimInvoiceType(type)) return items.map((it) => ({ ...it, pilgrimId: null }));
  const fieldErrors: Record<string, string> = {};
  const seen = new Set<string>();
  items.forEach((it, i) => {
    if (!it.pilgrimId) fieldErrors[`items.${i}.pilgrimId`] = "Choose the pilgrim";
    else if (seen.has(it.pilgrimId))
      fieldErrors[`items.${i}.pilgrimId`] = "Already on this invoice";
    else seen.add(it.pilgrimId);
  });
  const ids = [...seen];
  const [pilgrims, existing] = await Promise.all([
    tx.pilgrim.findMany({ where: { id: { in: ids } } }),
    invoiceId
      ? tx.invoiceItem.findMany({ where: { invoiceId }, select: { pilgrimId: true } })
      : Promise.resolve([]),
  ]);
  const kept = new Set(existing.map((e) => e.pilgrimId));
  items.forEach((it, i) => {
    if (!it.pilgrimId || fieldErrors[`items.${i}.pilgrimId`]) return;
    const p = pilgrims.find((x) => x.id === it.pilgrimId);
    if (!p) fieldErrors[`items.${i}.pilgrimId`] = "Choose a valid pilgrim";
    else if (!kept.has(p.id) && !isActive(p))
      fieldErrors[`items.${i}.pilgrimId`] =
        `${p.name} is ${p.status.toLowerCase().replace("_", " ")}`;
  });
  if (Object.keys(fieldErrors).length) throw new ServiceError("Check the pilgrims", fieldErrors);
  return items.map((it) => {
    const p = pilgrims.find((x) => x.id === it.pilgrimId)!;
    return {
      ...it,
      kind: "PILGRIM" as const,
      qty: "1",
      passengerName: p.name,
      passportNo: p.passportNo,
      groupId: it.groupId ?? p.groupId,
    };
  });
}

function prepareItems(ctx: ServiceContext, type: ItemInvoiceType, input: ParsedItem[]) {
  return async (tx: TenantTx, invoiceId: string | null): Promise<PreparedLines> => {
    const items = await withPilgrims(tx, type, input, invoiceId);
    await assertItemRefs(tx, items);
    const rows = items.map((it, i) => {
      const r = calcItemLine(it);
      return {
        sortOrder: i,
        kind: it.kind,
        productId: it.productId ?? null,
        sourceId: it.sourceId ?? null,
        description: it.description,
        qty: new Prisma.Decimal(it.qty),
        unitPrice: new Prisma.Decimal(it.unitPrice),
        unitCost: new Prisma.Decimal(it.unitCost),
        clientPrice: dec(r.clientPrice),
        purchasePrice: dec(r.purchasePrice),
        profit: dec(r.profit),
        vendorId: it.vendorId ?? null,
        passengerName: it.passengerName ?? null,
        passportNo: it.passportNo ?? null,
        groupId: it.groupId ?? null,
        roomTypeId: it.roomTypeId ?? null,
        serviceDate: it.serviceDate ? isoToDate(it.serviceDate) : null,
        pilgrimId: it.pilgrimId ?? null,
      };
    });
    return {
      totals: rows,
      costs: rows
        .filter((r) => r.vendorId && r.purchasePrice.greaterThan(0))
        .map((r) => ({ vendorId: r.vendorId!, amount: r.purchasePrice })),
      write: async (t, id) => {
        await t.invoiceItem.createMany({
          data: rows.map((r) => ({ ...r, agencyId: ctx.agencyId, invoiceId: id })),
        });
      },
      audit: rows,
    };
  };
}

export async function createItemInvoice(
  ctx: ServiceContext,
  type: ItemInvoiceType,
  input: unknown,
): Promise<{ id: string; number: string }> {
  const data = itemInvoiceSchema.parse(input);
  return createInvoice(ctx, type, data, prepareItems(ctx, type, data.items));
}

export async function updateItemInvoice(
  ctx: ServiceContext,
  type: ItemInvoiceType,
  id: string,
  input: unknown,
): Promise<void> {
  const data = itemInvoiceSchema.parse(input);
  await updateInvoice(ctx, type, id, data, prepareItems(ctx, type, data.items));
}

export async function postDraftItemInvoice(ctx: ServiceContext, type: ItemInvoiceType, id: string) {
  const inv = await getItemInvoice(ctx, type, id);
  if (!inv) throw new NotFoundError("Invoice");
  if (inv.status !== "DRAFT") throw new ServiceError("Only a draft can be posted");
  await updateItemInvoice(ctx, type, id, { ...itemFormValues(inv), post: true });
}

export async function getItemInvoice(ctx: ServiceContext, type: InvoiceType, id: string) {
  const inv = await tenantDb(ctx.agencyId).invoice.findFirst({
    where: { id, type },
    include: {
      client: {
        select: { id: true, name: true, code: true, phone: true, email: true, address: true },
      },
      agent: { select: { id: true, name: true, code: true } },
      salesman: { select: { id: true, name: true } },
      tourGroup: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          vendor: { select: { id: true, name: true } },
          product: { select: { name: true } },
          group: { select: { name: true } },
          roomType: { select: { name: true } },
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
  const iso = (v: Date | null) => (v ? dateToIso(v) : null);
  return {
    id: inv.id,
    type: inv.type,
    number: inv.number,
    status: inv.status,
    date: dateToIso(inv.date),
    dueDate: iso(inv.dueDate),
    travelDate: iso(inv.travelDate),
    returnDate: iso(inv.returnDate),
    client: inv.client,
    agent: inv.agent,
    salesman: inv.salesman,
    tourGroup: inv.tourGroup,
    group: inv.group,
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
    items: inv.items.map((it) => ({
      id: it.id,
      kind: it.kind,
      productId: it.productId,
      product: it.product?.name ?? null,
      sourceId: it.sourceId,
      description: it.description,
      qty: it.qty.toString(),
      unitPrice: money(it.unitPrice),
      unitCost: money(it.unitCost),
      clientPrice: money(it.clientPrice),
      purchasePrice: money(it.purchasePrice),
      profit: money(it.profit),
      vendorId: it.vendorId,
      vendor: it.vendor?.name ?? null,
      passengerName: it.passengerName,
      passportNo: it.passportNo,
      groupId: it.groupId,
      group: it.group?.name ?? null,
      roomTypeId: it.roomTypeId,
      roomType: it.roomType?.name ?? null,
      serviceDate: iso(it.serviceDate),
      pilgrimId: it.pilgrimId,
    })),
    payments: inv.allocations.map((a) => ({
      receiptId: a.receipt.id,
      number: a.receipt.number,
      date: dateToIso(a.receipt.date),
      amount: money(a.amount),
    })),
  };
}

export type ItemInvoiceView = NonNullable<Awaited<ReturnType<typeof getItemInvoice>>>;

/** Form values for editing an existing item invoice. */
export function itemFormValues(inv: ItemInvoiceView) {
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
    tourGroupId: inv.tourGroup?.id ?? null,
    groupId: inv.group?.id ?? null,
    travelDate: inv.travelDate,
    returnDate: inv.returnDate,
    items: inv.items.map((it) => ({
      kind: it.kind,
      productId: it.productId,
      sourceId: it.sourceId,
      description: it.description,
      qty: it.qty,
      unitPrice: it.unitPrice,
      unitCost: it.unitCost,
      vendorId: it.vendorId,
      passengerName: it.passengerName,
      passportNo: it.passportNo,
      groupId: it.groupId,
      roomTypeId: it.roomTypeId,
      serviceDate: it.serviceDate,
      pilgrimId: it.pilgrimId,
    })),
  };
}

/** Tour itinerary masters as pick lists with their default cost and vendor. */
export async function tourItineraryOptions(ctx: ServiceContext) {
  const db = tenantDb(ctx.agencyId);
  const where = { isActive: true };
  const select = { id: true, name: true, cost: true, vendorId: true } as const;
  const [accommodations, transports, otherTransports, guides, foods, places, tickets] =
    await Promise.all([
      db.accommodation.findMany({
        where,
        select: { ...select, city: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      db.transport.findMany({ where, select, orderBy: { name: "asc" } }),
      db.otherTransport.findMany({ where, select, orderBy: { name: "asc" } }),
      db.guide.findMany({ where, select, orderBy: { name: "asc" } }),
      db.food.findMany({ where, select, orderBy: { name: "asc" } }),
      db.place.findMany({
        where,
        select: { ...select, city: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      db.tourTicket.findMany({ where, select, orderBy: { name: "asc" } }),
    ]);
  type Row = {
    id: string;
    name: string;
    cost: Prisma.Decimal;
    vendorId: string | null;
    city?: { name: string } | null;
  };
  const opt = (kind: string, label: string, rows: Row[]) =>
    rows.map((r) => ({
      kind,
      group: label,
      id: r.id,
      name: r.city?.name ? `${r.name} (${r.city.name})` : r.name,
      cost: r.cost.toFixed(2),
      vendorId: r.vendorId,
    }));
  return [
    ...opt("ACCOMMODATION", "Accommodation", accommodations),
    ...opt("TRANSPORT", "Transport", transports),
    ...opt("OTHER_TRANSPORT", "Other transport", otherTransports),
    ...opt("GUIDE", "Guide", guides),
    ...opt("FOOD", "Food", foods),
    ...opt("PLACE", "Place / sightseeing", places),
    ...opt("TOUR_TICKET", "Tickets", tickets),
  ];
}

export type ItineraryOption = Awaited<ReturnType<typeof tourItineraryOptions>>[number];
