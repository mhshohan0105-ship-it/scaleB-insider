// Hajji transfers (PLAN.md 6.17): moallem, group, out to another agency and
// in from another agency. Each is a numbered document (HTR-) that remembers
// every pilgrim's previous value, so it can be voided. An optional charge per
// pilgrim is billed to the pilgrim's paying client:
//   Dr Accounts Receivable (client)  /  Cr Service Charge Income
import { Prisma, type HajjTransferType, type PilgrimStatus } from "@prisma/client";
import { dateToIso, isoToDate } from "@/lib/dates";
import type { ListParams } from "@/lib/listParams";
import { voidSchema } from "@/lib/schemas/accounts";
import {
  groupTransferSchema,
  moallemTransferSchema,
  transferInSchema,
  transferOutSchema,
} from "@/lib/schemas/hajj";
import { systemAccounts } from "@/server/accounting/ledgers";
import { postEntry, reverseSource } from "@/server/accounting/post";
import type { LineInput } from "@/server/accounting/validate";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";
import { documentNumber } from "../numbering/documentNumber";
import { addEvent, assertAction, assertTrackingFree, lockPilgrims } from "./pilgrimService";

export const HAJJ_TRANSFER_SOURCE = "HAJJ_TRANSFER";

type OutgoingType = Exclude<HajjTransferType, "IN">;

const EVENT: Record<
  HajjTransferType,
  "MOALLEM_TRANSFER" | "GROUP_TRANSFER" | "TRANSFER_OUT" | "TRANSFER_IN"
> = {
  MOALLEM: "MOALLEM_TRANSFER",
  GROUP: "GROUP_TRANSFER",
  OUT: "TRANSFER_OUT",
  IN: "TRANSFER_IN",
};

/** Bills the transfer charge to each pilgrim's client (one line per client). */
async function postCharges(
  tx: TenantTx,
  ctx: ServiceContext,
  t: { id: string; number: string; date: string; type: HajjTransferType },
  charges: { clientId: string; amount: Prisma.Decimal }[],
) {
  const byClient = new Map<string, Prisma.Decimal>();
  for (const c of charges)
    if (c.amount.greaterThan(0))
      byClient.set(c.clientId, (byClient.get(c.clientId) ?? new Prisma.Decimal(0)).plus(c.amount));
  if (!byClient.size) return;
  const acc = await systemAccounts(tx, ["AR", "SERVICE_CHARGE_INCOME"] as const);
  const total = [...byClient.values()].reduce((a, b) => a.plus(b), new Prisma.Decimal(0));
  const lines: LineInput[] = [...byClient].map(([clientId, amount]) => ({
    ledgerAccountId: acc.AR,
    debit: amount,
    partyType: "CLIENT",
    partyId: clientId,
    memo: t.number,
  }));
  lines.push({
    ledgerAccountId: acc.SERVICE_CHARGE_INCOME,
    credit: total,
    memo: "Hajj transfer charge",
  });
  await postEntry(tx, ctx, {
    date: t.date,
    sourceType: HAJJ_TRANSFER_SOURCE,
    sourceId: t.id,
    narration: `Hajj transfer ${t.number}`,
    lines,
  });
}

function parseOutgoing(type: OutgoingType, input: unknown) {
  if (type === "MOALLEM") {
    const d = moallemTransferSchema.parse(input);
    return { ...d, target: d.moallem };
  }
  if (type === "GROUP") {
    const d = groupTransferSchema.parse(input);
    return { ...d, target: d.groupId };
  }
  const d = transferOutSchema.parse(input);
  return { ...d, target: d.agency };
}

/** Moallem transfer, group transfer or transfer out of existing pilgrims. */
export async function createTransfer(
  ctx: ServiceContext,
  type: OutgoingType,
  input: unknown,
): Promise<{ id: string; number: string }> {
  const data = parseOutgoing(type, input);
  const charge = new Prisma.Decimal(data.chargePerPilgrim);

  return tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const pilgrims = await lockPilgrims(tx, ctx.agencyId, data.pilgrimIds);
    if (pilgrims.length !== data.pilgrimIds.length)
      throw new ServiceError("Some pilgrims were not found", { pilgrimIds: "Choose again" });
    for (const p of pilgrims) assertAction(type, p);

    let toLabel = data.target;
    let toGroupId: string | null = null;
    const groupNames = new Map<string, string>();
    if (type === "GROUP") {
      const group = await tx.group.findFirst({ where: { id: data.target } });
      if (!group) throw new ServiceError("Group not found", { groupId: "Choose a valid group" });
      toLabel = group.name;
      toGroupId = group.id;
      const ids = pilgrims.map((p) => p.groupId).filter((x): x is string => !!x);
      for (const g of await tx.group.findMany({ where: { id: { in: ids } } }))
        groupNames.set(g.id, g.name);
    }
    const current = (p: (typeof pilgrims)[number]) =>
      type === "MOALLEM" ? p.moallem : type === "GROUP" ? p.groupId : p.status;
    const same = pilgrims.find((p) =>
      type === "MOALLEM"
        ? p.moallem === toLabel
        : type === "GROUP"
          ? p.groupId === toGroupId
          : false,
    );
    if (same) throw new ServiceError(`${same.name} is already with ${toLabel}`);

    const number = await documentNumber(tx, ctx, "HAJJ_TRANSFER", data.date);
    const transfer = await tx.hajjTransfer.create({
      data: {
        agencyId: ctx.agencyId,
        number,
        type,
        date: isoToDate(data.date),
        toLabel,
        toGroupId,
        chargePerPilgrim: charge,
        totalCharge: charge.times(pilgrims.length),
        note: data.note ?? null,
        createdById: ctx.userId,
      },
    });
    await tx.hajjTransferLine.createMany({
      data: pilgrims.map((p) => ({
        agencyId: ctx.agencyId,
        transferId: transfer.id,
        pilgrimId: p.id,
        clientId: p.clientId,
        fromValue: current(p),
        fromStatus: p.status,
        charge,
      })),
    });
    for (const p of pilgrims) {
      await tx.pilgrim.update({
        where: { id: p.id },
        data:
          type === "MOALLEM"
            ? { moallem: toLabel }
            : type === "GROUP"
              ? { groupId: toGroupId }
              : { status: "TRANSFERRED_OUT", transferredTo: toLabel },
      });
      await addEvent(tx, ctx, {
        pilgrimId: p.id,
        type: EVENT[type],
        date: data.date,
        fromValue:
          type === "GROUP"
            ? ((p.groupId ? groupNames.get(p.groupId) : null) ?? null)
            : type === "MOALLEM"
              ? p.moallem
              : null,
        toValue: toLabel,
        note: data.note ?? null,
        transferId: transfer.id,
      });
    }
    await postCharges(
      tx,
      ctx,
      { id: transfer.id, number, date: data.date, type },
      pilgrims.map((p) => ({ clientId: p.clientId, amount: charge })),
    );
    await recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "HajjTransfer",
      entityId: transfer.id,
      after: { ...transfer, pilgrimIds: data.pilgrimIds },
    });
    return { id: transfer.id, number };
  });
}

/** Pilgrims arriving from another agency: creates their records. */
export async function createTransferIn(
  ctx: ServiceContext,
  input: unknown,
): Promise<{ id: string; number: string; pilgrimIds: string[] }> {
  const data = transferInSchema.parse(input);
  const charge = new Prisma.Decimal(data.chargePerPilgrim);
  const date = (v?: string | null) => (v ? isoToDate(v) : null);

  return tenantDb(ctx.agencyId).$transaction(async (tx) => {
    if (!(await tx.client.findFirst({ where: { id: data.clientId }, select: { id: true } })))
      throw new ServiceError("Client not found", { clientId: "Choose a valid client" });
    if (data.groupId && !(await tx.group.findFirst({ where: { id: data.groupId } })))
      throw new ServiceError("Group not found", { groupId: "Choose a valid group" });
    await assertTrackingFree(
      tx,
      data.pilgrims.map((p) => p.trackingNo),
    );

    const number = await documentNumber(tx, ctx, "HAJJ_TRANSFER", data.date);
    const transfer = await tx.hajjTransfer.create({
      data: {
        agencyId: ctx.agencyId,
        number,
        type: "IN",
        date: isoToDate(data.date),
        toLabel: data.agency,
        toGroupId: data.groupId ?? null,
        chargePerPilgrim: charge,
        totalCharge: charge.times(data.pilgrims.length),
        note: data.note ?? null,
        createdById: ctx.userId,
      },
    });
    const ids: string[] = [];
    for (const row of data.pilgrims) {
      const p = await tx.pilgrim.create({
        data: {
          agencyId: ctx.agencyId,
          clientId: data.clientId,
          hajjYear: data.hajjYear,
          groupId: data.groupId ?? null,
          moallem: data.moallem ?? null,
          name: row.name,
          gender: row.gender ?? null,
          dateOfBirth: date(row.dateOfBirth),
          passportNo: row.passportNo ?? null,
          passportExpiry: date(row.passportExpiry),
          nidNo: row.nidNo ?? null,
          phone: row.phone ?? null,
          address: row.address ?? null,
          trackingNo: row.trackingNo ?? null,
          preRegNo: row.preRegNo ?? null,
          preRegDate: date(row.preRegDate),
          regNo: row.regNo ?? null,
          regDate: date(row.regDate),
          voucherNo: row.voucherNo ?? null,
          maharamId: row.maharamId ?? null,
          maharamName: row.maharamName ?? null,
          note: row.note ?? null,
          status: "TRANSFERRED_IN",
          transferredFrom: data.agency,
          createdById: ctx.userId,
        },
      });
      ids.push(p.id);
      await tx.hajjTransferLine.create({
        data: {
          agencyId: ctx.agencyId,
          transferId: transfer.id,
          pilgrimId: p.id,
          clientId: data.clientId,
          fromValue: data.agency,
          fromStatus: null,
          charge,
        },
      });
      await addEvent(tx, ctx, {
        pilgrimId: p.id,
        type: "TRANSFER_IN",
        date: data.date,
        fromValue: data.agency,
        note: data.note ?? null,
        transferId: transfer.id,
      });
    }
    await postCharges(
      tx,
      ctx,
      { id: transfer.id, number, date: data.date, type: "IN" },
      ids.map(() => ({ clientId: data.clientId, amount: charge })),
    );
    await recordAudit(tx, ctx, {
      action: "CREATE",
      entity: "HajjTransfer",
      entityId: transfer.id,
      after: { ...transfer, pilgrimIds: ids },
    });
    return { id: transfer.id, number, pilgrimIds: ids };
  });
}

/**
 * Voids a transfer: every pilgrim goes back to what they had, provided nothing
 * changed since. Voiding a transfer in cancels the pilgrims it created (they
 * must not be on live invoices). The charge entry is reversed.
 */
export async function voidTransfer(ctx: ServiceContext, id: string, input: unknown, today: string) {
  const { reason } = voidSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await tx.hajjTransfer.findFirst({ where: { id }, include: { lines: true } });
    if (!before) throw new NotFoundError("Transfer");
    if (before.status === "VOID") throw new ServiceError("This transfer is already void");
    const pilgrims = await lockPilgrims(
      tx,
      ctx.agencyId,
      before.lines.map((l) => l.pilgrimId),
    );
    for (const line of before.lines) {
      const p = pilgrims.find((x) => x.id === line.pilgrimId)!;
      const unchanged =
        before.type === "MOALLEM"
          ? p.moallem === before.toLabel
          : before.type === "GROUP"
            ? p.groupId === before.toGroupId
            : before.type === "OUT"
              ? p.status === "TRANSFERRED_OUT"
              : p.status === "TRANSFERRED_IN";
      if (!unchanged)
        throw new ServiceError(`${p.name} has changed since this transfer; it cannot be voided`);
      if (before.type === "IN") {
        const live = await tx.invoiceItem.count({
          where: { pilgrimId: p.id, invoice: { status: { not: "VOID" } } },
        });
        if (live) throw new ServiceError(`${p.name} is on an invoice; void that invoice first`);
      }
    }
    for (const line of before.lines) {
      await tx.pilgrim.update({
        where: { id: line.pilgrimId },
        data:
          before.type === "MOALLEM"
            ? { moallem: line.fromValue }
            : before.type === "GROUP"
              ? { groupId: line.fromValue }
              : before.type === "OUT"
                ? {
                    status: (line.fromStatus ?? "PRE_REGISTERED") as PilgrimStatus,
                    transferredTo: null,
                  }
                : {
                    status: "CANCELLED",
                    cancelledDate: isoToDate(today),
                    cancelReason: `Transfer in ${before.number} voided`,
                  },
      });
      await addEvent(tx, ctx, {
        pilgrimId: line.pilgrimId,
        type: "TRANSFER_VOIDED",
        date: today,
        fromValue: before.toLabel,
        note: `${before.number}: ${reason}`,
        transferId: before.id,
      });
    }
    if (before.totalCharge.greaterThan(0)) {
      await reverseSource(tx, ctx, HAJJ_TRANSFER_SOURCE, id, {
        narration: `Void of ${before.number}: ${reason}`,
      });
    }
    const after = await tx.hajjTransfer.update({
      where: { id },
      data: { status: "VOID", voidReason: reason, voidedAt: new Date(), voidedById: ctx.userId },
    });
    await recordAudit(tx, ctx, {
      action: "VOID",
      entity: "HajjTransfer",
      entityId: id,
      before,
      after,
    });
  });
}

export interface TransferRow {
  id: string;
  number: string;
  type: HajjTransferType;
  date: string;
  toLabel: string;
  pilgrims: { id: string; name: string; from: string | null }[];
  totalCharge: string;
  status: string;
  note: string | null;
  voidReason: string | null;
}

export async function listTransfers(
  ctx: ServiceContext,
  type: HajjTransferType,
  params: ListParams,
) {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.HajjTransferWhereInput = { type };
  if (params.from || params.to) {
    where.date = {
      ...(params.from ? { gte: isoToDate(params.from) } : {}),
      ...(params.to ? { lte: isoToDate(params.to) } : {}),
    };
  }
  const q = params.q?.trim();
  if (q) {
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { toLabel: { contains: q, mode: "insensitive" } },
      { lines: { some: { pilgrim: { name: { contains: q, mode: "insensitive" } } } } },
      { lines: { some: { pilgrim: { trackingNo: { contains: q, mode: "insensitive" } } } } },
    ];
  }
  const [rows, total] = await Promise.all([
    db.hajjTransfer.findMany({
      where,
      include: { lines: { include: { pilgrim: { select: { id: true, name: true } } } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.hajjTransfer.count({ where }),
  ]);
  // Previous group ids are shown by name.
  const groupIds = [
    ...new Set(
      rows
        .filter((r) => r.type === "GROUP")
        .flatMap((r) => r.lines.map((l) => l.fromValue))
        .filter((x): x is string => !!x),
    ),
  ];
  const groups = new Map(
    (
      await db.group.findMany({ where: { id: { in: groupIds } }, select: { id: true, name: true } })
    ).map((g) => [g.id, g.name]),
  );
  return {
    total,
    rows: rows.map((r): TransferRow => ({
      id: r.id,
      number: r.number,
      type: r.type,
      date: dateToIso(r.date),
      toLabel: r.toLabel,
      pilgrims: r.lines.map((l) => ({
        id: l.pilgrim.id,
        name: l.pilgrim.name,
        from:
          r.type === "GROUP"
            ? ((l.fromValue ? groups.get(l.fromValue) : null) ?? null)
            : r.type === "OUT"
              ? null
              : l.fromValue,
      })),
      totalCharge: r.totalCharge.toFixed(2),
      status: r.status,
      note: r.note,
      voidReason: r.voidReason,
    })),
  };
}

export type TransferList = Awaited<ReturnType<typeof listTransfers>>;
