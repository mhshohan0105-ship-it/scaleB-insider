// Combined clients (PLAN.md 5 "CombinedClient"): a party we both sell to and
// buy from. Decision (2026-09-30): the receivable and the payable stay
// separate in the books. A combined client is linked to one client account
// (its invoices and receipts, in AR) and one vendor account (its purchases
// and payments, in AP); its own row keeps only its opening balance. Pages show
// the three together with the net, and a set-off settles what they owe us
// against what we owe them: Dr AP (vendor) / Cr AR (client), allocated to the
// client's open invoices oldest first.
import { Prisma, type PartyType } from "@prisma/client";
import { autoAllocate } from "@/lib/calc/allocation";
import { dateToIso, isoToDate } from "@/lib/dates";
import type { ListParams } from "@/lib/listParams";
import { PARTIES } from "@/lib/parties";
import { voidSchema } from "@/lib/schemas/accounts";
import { setOffSchema } from "@/lib/schemas/money";
import { systemAccounts } from "@/server/accounting/ledgers";
import { postEntry, reverseSource } from "@/server/accounting/post";
import { VOUCHER_ACCOUNT_KEYS, voucherLines } from "@/server/accounting/voucherPosting";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb, type TenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";
import { documentNumber } from "../numbering/documentNumber";
import { formatNumber, nextSequence } from "../numbering/sequence";
import { applyPayment, dueInvoices } from "../payments/receiptService";
import { VOUCHER_SOURCE } from "../vouchers/voucherService";

type Db = TenantDb | TenantTx;

/**
 * Gives a combined client its client and vendor accounts: any link left empty
 * gets a new account with the same name and contact details (no opening
 * balance; the combined client's own opening stays on its row).
 */
export async function linkCombinedAccounts(tx: TenantTx, ctx: ServiceContext, id: string) {
  const c = await tx.combinedClient.findFirst({ where: { id } });
  if (!c || (c.clientId && c.vendorId)) return;
  const contact = { name: c.name, phone: c.phone, email: c.email, address: c.address };
  const data: { clientId?: string; vendorId?: string } = {};
  if (!c.clientId) {
    const n = await nextSequence(tx, ctx.agencyId, "PARTY_CLIENTS");
    const client = await tx.client.create({
      data: {
        agencyId: ctx.agencyId,
        code: formatNumber(PARTIES.clients.codePrefix!, n),
        type: "CORPORATE",
        ...contact,
        note: `Client account of combined client ${c.code}`,
        createdById: ctx.userId,
      },
    });
    await recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "Client",
      entityId: client.id,
      after: client,
    });
    data.clientId = client.id;
  }
  if (!c.vendorId) {
    const n = await nextSequence(tx, ctx.agencyId, "PARTY_VENDORS");
    const vendor = await tx.vendor.create({
      data: {
        agencyId: ctx.agencyId,
        code: formatNumber(PARTIES.vendors.codePrefix!, n),
        contactPerson: c.contactPerson,
        ...contact,
        note: `Vendor account of combined client ${c.code}`,
        createdById: ctx.userId,
      },
    });
    await recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "Vendor",
      entityId: vendor.id,
      after: vendor,
    });
    data.vendorId = vendor.id;
  }
  await tx.combinedClient.update({ where: { id }, data });
}

/** Journal parties whose lines make up a combined client's ledger. */
export async function combinedParties(
  db: Db,
  id: string,
): Promise<{ partyType: PartyType; partyId: string }[]> {
  const c = await db.combinedClient.findFirst({
    where: { id },
    select: { clientId: true, vendorId: true },
  });
  if (!c) return [{ partyType: "COMBINED", partyId: id }];
  return [
    { partyType: "COMBINED" as PartyType, partyId: id },
    ...(c.clientId ? [{ partyType: "CLIENT" as PartyType, partyId: c.clientId }] : []),
    ...(c.vendorId ? [{ partyType: "VENDOR" as PartyType, partyId: c.vendorId }] : []),
  ];
}

/** The combined client whose client or vendor account this is, if any. */
export async function combinedOf(ctx: ServiceContext, side: "client" | "vendor", id: string) {
  return tenantDb(ctx.agencyId).combinedClient.findFirst({
    where: side === "client" ? { clientId: id } : { vendorId: id },
    select: { id: true, name: true, code: true },
  });
}

async function loadLinked(db: Db, id: string, lock = false) {
  const c = await db.combinedClient.findFirst({
    where: { id },
    include: {
      client: { select: { id: true, balance: true } },
      vendor: { select: { id: true, balance: true } },
    },
  });
  if (!c) throw new NotFoundError("Combined client");
  if (!c.client || !c.vendor)
    throw new ServiceError("Link a client account and a vendor account first (Edit)");
  if (lock) {
    // Serialise set-offs and payments on the two accounts.
    await (db as TenantTx).$queryRaw`SELECT id FROM "Client" WHERE id = ${c.client.id} FOR UPDATE`;
    await (db as TenantTx).$queryRaw`SELECT id FROM "Vendor" WHERE id = ${c.vendor.id} FOR UPDATE`;
  }
  // Receivable: what the client side owes us. Payable: what we owe the vendor side.
  const receivable = Prisma.Decimal.max(c.client.balance, 0);
  const payable = Prisma.Decimal.max(c.vendor.balance.negated(), 0);
  return { c, receivable, payable, max: Prisma.Decimal.min(receivable, payable) };
}

/** What can be set off now (the smaller of receivable and payable). */
export async function setOffLimit(ctx: ServiceContext, id: string) {
  const r = await loadLinked(tenantDb(ctx.agencyId), id);
  return {
    receivable: r.receivable.toFixed(2),
    payable: r.payable.toFixed(2),
    max: r.max.toFixed(2),
  };
}

export async function createSetOff(
  ctx: ServiceContext,
  id: string,
  input: unknown,
): Promise<{ id: string; number: string }> {
  const data = setOffSchema.parse(input);
  const amount = new Prisma.Decimal(data.amount);
  return tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const { c, max } = await loadLinked(tx, id, true);
    if (amount.greaterThan(max))
      throw new ServiceError(
        max.isZero()
          ? "Nothing to set off: they must owe us and we must owe them"
          : `At most ${max.toFixed(2)} can be set off`,
        { amount: "More than can be set off" },
      );

    const lines = voucherLines(
      {
        kind: "SET_OFF",
        amount,
        setOff: { clientId: c.client!.id, vendorId: c.vendor!.id },
        memo: data.note ?? null,
      },
      await systemAccounts(tx, VOUCHER_ACCOUNT_KEYS),
    );
    const number = await documentNumber(tx, ctx, "SET_OFF", data.date);
    const voucher = await tx.voucher.create({
      data: {
        agencyId: ctx.agencyId,
        number,
        kind: "SET_OFF",
        date: isoToDate(data.date),
        amount,
        partyType: "COMBINED",
        partyId: c.id,
        note: data.note ?? null,
        createdById: ctx.userId,
      },
    });
    // Settle the client's open invoices, oldest first, like a receipt.
    const dues = await dueInvoices(tx, c.client!.id, true);
    const allocations = autoAllocate(amount.toString(), dues).allocations;
    for (const a of allocations) {
      const amt = new Prisma.Decimal(a.amount.toFixed(2));
      await tx.voucherAllocation.create({
        data: {
          agencyId: ctx.agencyId,
          voucherId: voucher.id,
          invoiceId: a.invoiceId,
          amount: amt,
        },
      });
      await applyPayment(tx, a.invoiceId, amt);
    }
    await postEntry(tx, ctx, {
      date: data.date,
      sourceType: VOUCHER_SOURCE,
      sourceId: voucher.id,
      narration: `Set-off ${number}: ${c.name}`,
      lines,
    });
    await recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "Voucher",
      entityId: voucher.id,
      after: { ...voucher, allocations },
    });
    return { id: voucher.id, number };
  });
}

/** Voids a set-off: reverses its entry and takes it off the invoices it settled. */
export async function voidSetOff(ctx: ServiceContext, id: string, input: unknown) {
  const { reason } = voidSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await tx.voucher.findFirst({
      where: { id, kind: "SET_OFF" },
      include: { allocations: true },
    });
    if (!before) throw new NotFoundError("Set-off");
    if (before.status === "VOID") throw new ServiceError("This set-off is already void");
    for (const a of before.allocations) await applyPayment(tx, a.invoiceId, a.amount.negated());
    await reverseSource(tx, ctx, VOUCHER_SOURCE, id, {
      narration: `Void of ${before.number}: ${reason}`,
    });
    const after = await tx.voucher.update({
      where: { id },
      data: { status: "VOID", voidReason: reason, voidedAt: new Date(), voidedById: ctx.userId },
    });
    await recordAudit(tx, ctx, { action: "VOID", entity: "Voucher", entityId: id, before, after });
  });
}

export async function listSetOffs(ctx: ServiceContext, combinedId: string, params: ListParams) {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.VoucherWhereInput = { kind: "SET_OFF", partyId: combinedId };
  const [rows, total] = await Promise.all([
    db.voucher.findMany({
      where,
      include: {
        allocations: { include: { invoice: { select: { id: true, number: true, type: true } } } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.voucher.count({ where }),
  ]);
  return {
    total,
    rows: rows.map((v) => ({
      id: v.id,
      number: v.number,
      date: dateToIso(v.date),
      amount: v.amount.toFixed(2),
      note: v.note,
      status: v.status,
      voidReason: v.voidReason,
      invoices: v.allocations.map((a) => ({
        id: a.invoice.id,
        number: a.invoice.number,
        type: a.invoice.type,
        amount: a.amount.toFixed(2),
      })),
    })),
  };
}

export type SetOffList = Awaited<ReturnType<typeof listSetOffs>>;
export type SetOffRow = SetOffList["rows"][number];
