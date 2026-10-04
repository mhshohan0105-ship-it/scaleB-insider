// Global search (PLAN.md section 4 header): invoices (by number, ticket no.,
// PNR or passenger), clients, vendors, money receipts, passports and
// pilgrims. Only what the user may view is searched.
import { can, type PermissionMap } from "@/lib/permissions";
import { INVOICE_TYPE_INFO, invoiceHref, type InvoiceTypeKey } from "@/lib/invoiceTypes";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "../context";

export interface SearchHit {
  group: string;
  label: string;
  detail: string | null;
  href: string;
}

const TAKE = 5;

export async function globalSearch(
  ctx: ServiceContext,
  permissions: PermissionMap,
  raw: string,
): Promise<SearchHit[]> {
  const q = raw.trim();
  if (q.length < 2) return [];
  const db = tenantDb(ctx.agencyId);
  const text = { contains: q, mode: "insensitive" as const };
  const visibleTypes = (Object.keys(INVOICE_TYPE_INFO) as InvoiceTypeKey[]).filter((t) =>
    can(permissions, INVOICE_TYPE_INFO[t].module, "view"),
  );
  const see = (m: Parameters<typeof can>[1]) => can(permissions, m, "view");

  const [invoices, clients, vendors, receipts, passports, pilgrims] = await Promise.all([
    visibleTypes.length
      ? db.invoice.findMany({
          where: {
            type: { in: visibleTypes },
            OR: [
              { number: text },
              {
                airTickets: {
                  some: { OR: [{ ticketNo: text }, { pnr: text }, { passengerName: text }] },
                },
              },
              { reissueLines: { some: { OR: [{ ticketNo: text }, { passengerName: text }] } } },
              { visaLines: { some: { OR: [{ passengerName: text }, { passportNo: text }] } } },
              { items: { some: { passengerName: text } } },
            ],
          },
          orderBy: { date: "desc" },
          take: TAKE,
          select: {
            id: true,
            number: true,
            type: true,
            status: true,
            client: { select: { name: true } },
          },
        })
      : [],
    see("clients")
      ? db.client.findMany({
          where: { OR: [{ name: text }, { code: text }, { phone: { contains: q } }] },
          take: TAKE,
          select: { id: true, name: true, code: true, phone: true },
        })
      : [],
    see("vendors")
      ? db.vendor.findMany({
          where: { OR: [{ name: text }, { code: text }, { phone: { contains: q } }] },
          take: TAKE,
          select: { id: true, name: true, code: true },
        })
      : [],
    see("money_receipt")
      ? db.moneyReceipt.findMany({
          where: { OR: [{ number: text }, { reference: text }] },
          orderBy: { date: "desc" },
          take: TAKE,
          select: { id: true, number: true, amount: true, client: { select: { name: true } } },
        })
      : [],
    see("passport")
      ? db.passport.findMany({
          where: { OR: [{ passportNo: text }, { name: text }] },
          take: TAKE,
          select: { id: true, passportNo: true, name: true },
        })
      : [],
    see("hajj")
      ? db.pilgrim.findMany({
          where: {
            OR: [{ name: text }, { trackingNo: text }, { passportNo: text }, { regNo: text }],
          },
          take: TAKE,
          select: { id: true, name: true, trackingNo: true, hajjYear: true },
        })
      : [],
  ]);

  return [
    ...invoices.map((i) => ({
      group: "Invoices",
      label: i.number,
      detail: `${INVOICE_TYPE_INFO[i.type as InvoiceTypeKey].label} · ${i.client.name}`,
      href: invoiceHref(i.type, i.id) ?? "/",
    })),
    ...clients.map((c) => ({
      group: "Clients",
      label: c.name,
      detail: [c.code, c.phone].filter(Boolean).join(" · "),
      href: `/clients/${c.id}`,
    })),
    ...vendors.map((v) => ({
      group: "Vendors",
      label: v.name,
      detail: v.code,
      href: `/vendors/${v.id}`,
    })),
    ...receipts.map((r) => ({
      group: "Money receipts",
      label: r.number,
      detail: `${r.client.name} · ${r.amount.toFixed(2)}`,
      href: `/moneyreceipts/${r.id}`,
    })),
    ...passports.map((p) => ({
      group: "Passports",
      label: p.passportNo,
      detail: p.name,
      href: `/passports/${p.id}`,
    })),
    ...pilgrims.map((p) => ({
      group: "Pilgrims",
      label: p.name,
      detail: [p.trackingNo, `Hajj ${p.hajjYear}`].filter(Boolean).join(" · "),
      href: `/hajj/pilgrims/${p.id}`,
    })),
  ];
}
