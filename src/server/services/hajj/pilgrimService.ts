// Pilgrims (Hajji) and their registration / cancellation (PLAN.md 6.17).
// Every change writes a PilgrimEvent (the pilgrim's history) and an audit
// entry. Moallem / group / in / out transfers live in transferService.ts.
import { Prisma, type PilgrimStatus } from "@prisma/client";
import { dateToIso, isoToDate } from "@/lib/dates";
import { PILGRIM_STATUS_LABEL, pilgrimActionError, type PilgrimAction } from "@/lib/hajj";
import type { ListParams } from "@/lib/listParams";
import { cancelPilgrimSchema, pilgrimSchema, registerSchema } from "@/lib/schemas/hajj";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError } from "../errors";

type Db = TenantTx | ReturnType<typeof tenantDb>;
const date = (v?: string | null) => (v ? isoToDate(v) : null);
const iso = (v: Date | null) => (v ? dateToIso(v) : null);

/** Locks pilgrim rows (sorted, to avoid deadlocks) and returns them. */
export async function lockPilgrims(tx: TenantTx, agencyId: string, ids: string[]) {
  if (!ids.length) return [];
  await tx.$queryRaw`
    SELECT id FROM "Pilgrim" WHERE id IN (${Prisma.join([...ids].sort())}) AND "agencyId" = ${agencyId}
    ORDER BY id FOR UPDATE`;
  return tx.pilgrim.findMany({ where: { id: { in: ids } } });
}

export function assertAction(
  action: PilgrimAction,
  p: { name: string; status: string; regNo: string | null },
) {
  const error = pilgrimActionError(action, p);
  if (error) throw new ServiceError(`${p.name}: ${error}`);
}

async function assertRefs(
  tx: TenantTx,
  refs: { clientId?: string; groupId?: string | null; maharamId?: string | null },
) {
  if (
    refs.clientId &&
    !(await tx.client.findFirst({ where: { id: refs.clientId }, select: { id: true } }))
  )
    throw new ServiceError("Client not found", { clientId: "Choose a valid client" });
  if (
    refs.groupId &&
    !(await tx.group.findFirst({ where: { id: refs.groupId }, select: { id: true } }))
  )
    throw new ServiceError("Group not found", { groupId: "Choose a valid group" });
  if (
    refs.maharamId &&
    !(await tx.maharam.findFirst({ where: { id: refs.maharamId }, select: { id: true } }))
  )
    throw new ServiceError("Relation not found", { maharamId: "Choose a valid relation" });
}

/** Tracking numbers are unique among pilgrims who are not cancelled. */
export async function assertTrackingFree(
  tx: TenantTx,
  trackingNos: (string | null | undefined)[],
  exceptId?: string,
) {
  const list = trackingNos.filter((t): t is string => !!t);
  if (new Set(list).size !== list.length)
    throw new ServiceError("A tracking number is listed twice");
  if (!list.length) return;
  const taken = await tx.pilgrim.findFirst({
    where: {
      trackingNo: { in: list },
      status: { not: "CANCELLED" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { name: true, trackingNo: true },
  });
  if (taken)
    throw new ServiceError(`Tracking no. ${taken.trackingNo} is already used by ${taken.name}`, {
      trackingNo: "Already used",
    });
}

export async function addEvent(
  tx: TenantTx,
  ctx: ServiceContext,
  e: {
    pilgrimId: string;
    type: Prisma.PilgrimEventCreateManyInput["type"];
    date: string;
    fromValue?: string | null;
    toValue?: string | null;
    note?: string | null;
    transferId?: string | null;
  },
) {
  await tx.pilgrimEvent.create({
    data: {
      agencyId: ctx.agencyId,
      pilgrimId: e.pilgrimId,
      type: e.type,
      date: isoToDate(e.date),
      fromValue: e.fromValue ?? null,
      toValue: e.toValue ?? null,
      note: e.note ?? null,
      transferId: e.transferId ?? null,
      createdById: ctx.userId,
    },
  });
}

export async function createPilgrim(
  ctx: ServiceContext,
  input: unknown,
  today: string,
): Promise<{ id: string }> {
  const data = pilgrimSchema.parse(input);
  return tenantDb(ctx.agencyId).$transaction(async (tx) => {
    await assertRefs(tx, data);
    await assertTrackingFree(tx, [data.trackingNo]);
    const p = await tx.pilgrim.create({
      data: {
        agencyId: ctx.agencyId,
        clientId: data.clientId,
        name: data.name,
        gender: data.gender ?? null,
        dateOfBirth: date(data.dateOfBirth),
        passportNo: data.passportNo ?? null,
        passportExpiry: date(data.passportExpiry),
        nidNo: data.nidNo ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        hajjYear: data.hajjYear,
        trackingNo: data.trackingNo ?? null,
        preRegNo: data.preRegNo ?? null,
        preRegDate: date(data.preRegDate),
        groupId: data.groupId ?? null,
        maharamId: data.maharamId ?? null,
        maharamName: data.maharamName ?? null,
        moallem: data.moallem ?? null,
        note: data.note ?? null,
        status: "PRE_REGISTERED",
        createdById: ctx.userId,
      },
    });
    await addEvent(tx, ctx, { pilgrimId: p.id, type: "CREATED", date: data.preRegDate ?? today });
    await recordAudit(tx, ctx, { action: "CREATE", entity: "Pilgrim", entityId: p.id, after: p });
    return { id: p.id };
  });
}

/** Edits personal and pre registration details. Group and moallem change by transfer only. */
export async function updatePilgrim(
  ctx: ServiceContext,
  id: string,
  input: unknown,
  today: string,
): Promise<void> {
  const data = pilgrimSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const [before] = await lockPilgrims(tx, ctx.agencyId, [id]);
    if (!before) throw new NotFoundError("Pilgrim");
    if (before.clientId !== data.clientId) {
      const used = await tx.invoiceItem.count({
        where: { pilgrimId: id, invoice: { status: { not: "VOID" } } },
      });
      if (used)
        throw new ServiceError("This pilgrim is on invoices; the paying client cannot change", {
          clientId: "Locked",
        });
    }
    await assertRefs(tx, data);
    await assertTrackingFree(tx, [data.trackingNo], id);
    const after = await tx.pilgrim.update({
      where: { id },
      data: {
        clientId: data.clientId,
        name: data.name,
        gender: data.gender ?? null,
        dateOfBirth: date(data.dateOfBirth),
        passportNo: data.passportNo ?? null,
        passportExpiry: date(data.passportExpiry),
        nidNo: data.nidNo ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        hajjYear: data.hajjYear,
        trackingNo: data.trackingNo ?? null,
        preRegNo: data.preRegNo ?? null,
        preRegDate: date(data.preRegDate),
        maharamId: data.maharamId ?? null,
        maharamName: data.maharamName ?? null,
        note: data.note ?? null,
      },
    });
    await addEvent(tx, ctx, { pilgrimId: id, type: "UPDATED", date: today });
    await recordAudit(tx, ctx, {
      action: "UPDATE",
      entity: "Pilgrim",
      entityId: id,
      before,
      after,
    });
  });
}

export async function registerPilgrim(
  ctx: ServiceContext,
  id: string,
  input: unknown,
): Promise<void> {
  const data = registerSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const [before] = await lockPilgrims(tx, ctx.agencyId, [id]);
    if (!before) throw new NotFoundError("Pilgrim");
    assertAction("REGISTER", before);
    if (data.trackingNo) await assertTrackingFree(tx, [data.trackingNo], id);
    const after = await tx.pilgrim.update({
      where: { id },
      data: {
        status: "REGISTERED",
        regNo: data.regNo,
        regDate: isoToDate(data.regDate),
        voucherNo: data.voucherNo ?? before.voucherNo,
        trackingNo: data.trackingNo ?? before.trackingNo,
      },
    });
    await addEvent(tx, ctx, {
      pilgrimId: id,
      type: "REGISTERED",
      date: data.regDate,
      toValue: data.regNo,
    });
    await recordAudit(tx, ctx, {
      action: "UPDATE",
      entity: "Pilgrim",
      entityId: id,
      before,
      after,
    });
  });
}

export interface RefundableHajjInvoice {
  id: string;
  number: string;
  type: string;
}

/** Live Hajj invoices that bill this pilgrim (candidates for a refund). */
export async function pilgrimInvoices(db: Db, pilgrimId: string): Promise<RefundableHajjInvoice[]> {
  const rows = await db.invoice.findMany({
    where: {
      status: { in: ["POSTED", "PARTIAL", "PAID"] },
      items: { some: { pilgrimId } },
    },
    select: { id: true, number: true, type: true },
    orderBy: { date: "asc" },
  });
  return rows;
}

/**
 * Cancels a pre registration or a registration. Money is handled separately:
 * the result lists the pilgrim's live invoices so the user can refund them.
 */
export async function cancelPilgrim(
  ctx: ServiceContext,
  stage: "PRE_REG" | "REG",
  input: unknown,
): Promise<{ invoices: RefundableHajjInvoice[] }> {
  const data = cancelPilgrimSchema.parse(input);
  return tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const [before] = await lockPilgrims(tx, ctx.agencyId, [data.pilgrimId]);
    if (!before) throw new ServiceError("Pilgrim not found", { pilgrimId: "Choose a pilgrim" });
    assertAction(stage === "PRE_REG" ? "CANCEL_PRE_REG" : "CANCEL_REG", before);
    const after = await tx.pilgrim.update({
      where: { id: before.id },
      data: { status: "CANCELLED", cancelledDate: isoToDate(data.date), cancelReason: data.reason },
    });
    await addEvent(tx, ctx, {
      pilgrimId: before.id,
      type: stage === "PRE_REG" ? "CANCELLED_PRE_REG" : "CANCELLED_REG",
      date: data.date,
      fromValue: PILGRIM_STATUS_LABEL[before.status],
      note: data.reason,
    });
    await recordAudit(tx, ctx, {
      action: "UPDATE",
      entity: "Pilgrim",
      entityId: before.id,
      before,
      after,
    });
    return { invoices: await pilgrimInvoices(tx, before.id) };
  });
}

export interface PilgrimListQuery extends ListParams {
  pilgrimStatus?: string;
  year?: number;
  groupId?: string;
}

export interface PilgrimRow {
  id: string;
  name: string;
  passportNo: string | null;
  trackingNo: string | null;
  preRegNo: string | null;
  regNo: string | null;
  hajjYear: number;
  status: PilgrimStatus;
  clientId: string;
  clientName: string;
  group: string | null;
  moallem: string | null;
  phone: string | null;
}

export async function listPilgrims(ctx: ServiceContext, q: PilgrimListQuery) {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.PilgrimWhereInput = {};
  if (q.pilgrimStatus === "ACTIVE")
    where.status = { in: ["PRE_REGISTERED", "REGISTERED", "TRANSFERRED_IN"] };
  else if (q.pilgrimStatus) where.status = q.pilgrimStatus as PilgrimStatus;
  if (q.year) where.hajjYear = q.year;
  if (q.groupId) where.groupId = q.groupId;
  const text = q.q?.trim();
  if (text) {
    where.OR = [
      { name: { contains: text, mode: "insensitive" } },
      { passportNo: { contains: text, mode: "insensitive" } },
      { trackingNo: { contains: text, mode: "insensitive" } },
      { regNo: { contains: text, mode: "insensitive" } },
      { phone: { contains: text } },
      { client: { name: { contains: text, mode: "insensitive" } } },
    ];
  }
  const [rows, total, counts] = await Promise.all([
    db.pilgrim.findMany({
      where,
      include: { client: { select: { name: true } }, group: { select: { name: true } } },
      orderBy: [{ hajjYear: "desc" }, { name: "asc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    db.pilgrim.count({ where }),
    db.pilgrim.groupBy({
      by: ["status"],
      where: { ...where, status: undefined },
      _count: { _all: true },
    }),
  ]);
  return {
    total,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<
      string,
      number
    >,
    rows: rows.map((p): PilgrimRow => ({
      id: p.id,
      name: p.name,
      passportNo: p.passportNo,
      trackingNo: p.trackingNo,
      preRegNo: p.preRegNo,
      regNo: p.regNo,
      hajjYear: p.hajjYear,
      status: p.status,
      clientId: p.clientId,
      clientName: p.client.name,
      group: p.group?.name ?? null,
      moallem: p.moallem,
      phone: p.phone,
    })),
  };
}

export async function getPilgrim(ctx: ServiceContext, id: string) {
  const db = tenantDb(ctx.agencyId);
  const p = await db.pilgrim.findFirst({
    where: { id },
    include: {
      client: { select: { id: true, name: true, code: true } },
      group: { select: { id: true, name: true } },
      maharam: { select: { id: true, name: true } },
      events: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
      invoiceItems: {
        where: { invoice: { status: { not: "DRAFT" } } },
        include: {
          invoice: { select: { id: true, number: true, type: true, date: true, status: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    gender: p.gender,
    dateOfBirth: iso(p.dateOfBirth),
    passportNo: p.passportNo,
    passportExpiry: iso(p.passportExpiry),
    nidNo: p.nidNo,
    phone: p.phone,
    address: p.address,
    hajjYear: p.hajjYear,
    trackingNo: p.trackingNo,
    preRegNo: p.preRegNo,
    preRegDate: iso(p.preRegDate),
    regNo: p.regNo,
    regDate: iso(p.regDate),
    voucherNo: p.voucherNo,
    group: p.group,
    maharam: p.maharam,
    maharamName: p.maharamName,
    moallem: p.moallem,
    status: p.status,
    transferredFrom: p.transferredFrom,
    transferredTo: p.transferredTo,
    cancelledDate: iso(p.cancelledDate),
    cancelReason: p.cancelReason,
    note: p.note,
    client: p.client,
    events: p.events.map((e) => ({
      id: e.id,
      type: e.type,
      date: dateToIso(e.date),
      fromValue: e.fromValue,
      toValue: e.toValue,
      note: e.note,
    })),
    invoiceLines: p.invoiceItems.map((it) => ({
      id: it.id,
      description: it.description,
      clientPrice: it.clientPrice.toFixed(2),
      invoice: { ...it.invoice, date: dateToIso(it.invoice.date) },
    })),
  };
}

export type PilgrimView = NonNullable<Awaited<ReturnType<typeof getPilgrim>>>;

/** Form values for editing a pilgrim. */
export function pilgrimFormValues(p: PilgrimView) {
  return {
    clientId: p.client.id,
    hajjYear: p.hajjYear,
    groupId: p.group?.id ?? null,
    moallem: p.moallem,
    name: p.name,
    gender: p.gender,
    dateOfBirth: p.dateOfBirth,
    passportNo: p.passportNo,
    passportExpiry: p.passportExpiry,
    nidNo: p.nidNo,
    phone: p.phone,
    address: p.address,
    trackingNo: p.trackingNo,
    preRegNo: p.preRegNo,
    preRegDate: p.preRegDate,
    maharamId: p.maharam?.id ?? null,
    maharamName: p.maharamName,
    note: p.note,
  };
}

export interface PilgrimOption {
  value: string;
  label: string;
  status: PilgrimStatus;
  regNo: string | null;
  clientId: string;
  groupId: string | null;
  moallem: string | null;
}

/** Pilgrims as pick list options (active only by default), newest Hajj year first. */
export async function pilgrimOptions(
  ctx: ServiceContext,
  opts: { includeInactive?: boolean; ids?: string[] } = {},
): Promise<PilgrimOption[]> {
  const rows = await tenantDb(ctx.agencyId).pilgrim.findMany({
    where: opts.includeInactive
      ? {}
      : {
          OR: [
            { status: { in: ["PRE_REGISTERED", "REGISTERED", "TRANSFERRED_IN"] } },
            ...(opts.ids?.length ? [{ id: { in: opts.ids } }] : []),
          ],
        },
    orderBy: [{ hajjYear: "desc" }, { name: "asc" }],
    take: 3000,
    select: {
      id: true,
      name: true,
      passportNo: true,
      trackingNo: true,
      hajjYear: true,
      status: true,
      regNo: true,
      clientId: true,
      groupId: true,
      moallem: true,
    },
  });
  return rows.map((p) => ({
    value: p.id,
    label: [p.name, p.passportNo, p.trackingNo && `T ${p.trackingNo}`, String(p.hajjYear)]
      .filter(Boolean)
      .join(" · "),
    status: p.status,
    regNo: p.regNo,
    clientId: p.clientId,
    groupId: p.groupId,
    moallem: p.moallem,
  }));
}
