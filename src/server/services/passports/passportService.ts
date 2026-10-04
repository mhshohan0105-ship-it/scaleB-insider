// Passport management (PLAN.md 6.16): passports held or tracked for clients,
// with a status history, scans and expiry alerts.
import { Prisma } from "@prisma/client";
import { dateToIso, isoToDate } from "@/lib/dates";
import type { ListParams } from "@/lib/listParams";
import { addMonthsIso, EXPIRY_WARNING_MONTHS, expiryState, type ExpiryState } from "@/lib/passport";
import { passportSchema, passportStatusChangeSchema } from "@/lib/schemas/documents";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError, isUniqueViolation } from "../errors";

interface StatusEntry {
  status: string;
  at: string;
  by: string | null;
  note: string | null;
}

const date = (v?: string | null) => (v ? isoToDate(v) : null);
const iso = (v: Date | null) => (v ? dateToIso(v) : null);

function appendStatus(prev: unknown, status: string, by: string | null, note?: string | null) {
  const list = Array.isArray(prev) ? (prev as StatusEntry[]) : [];
  return [
    ...list,
    { status, at: new Date().toISOString(), by, note: note ?? null },
  ] as unknown as Prisma.InputJsonValue;
}

async function assertRefs(tx: TenantTx, v: { clientId?: string | null; statusId?: string | null }) {
  if (
    v.clientId &&
    !(await tx.client.findFirst({ where: { id: v.clientId }, select: { id: true } }))
  )
    throw new ServiceError("Client not found", { clientId: "Choose a valid client" });
  if (v.statusId) {
    const s = await tx.passportStatus.findFirst({
      where: { id: v.statusId },
      select: { name: true },
    });
    if (!s) throw new ServiceError("Status not found", { statusId: "Choose a valid status" });
    return s.name;
  }
  return null;
}

export async function savePassport(
  ctx: ServiceContext,
  id: string | null,
  input: unknown,
): Promise<{ id: string }> {
  const data = passportSchema.parse(input);
  const fields = {
    passportNo: data.passportNo,
    name: data.name,
    clientId: data.clientId ?? null,
    gender: data.gender ?? null,
    dateOfBirth: date(data.dateOfBirth),
    nationality: data.nationality ?? "Bangladeshi",
    placeOfIssue: data.placeOfIssue ?? null,
    issueDate: date(data.issueDate),
    expiryDate: isoToDate(data.expiryDate),
    phone: data.phone ?? null,
    receivedDate: date(data.receivedDate),
    returnedDate: date(data.returnedDate),
    note: data.note ?? null,
  };
  try {
    return await tenantDb(ctx.agencyId).$transaction(async (tx) => {
      const statusName = await assertRefs(tx, data);
      if (id) {
        const before = await tx.passport.findFirst({ where: { id } });
        if (!before) throw new NotFoundError("Passport");
        const statusChanged = (data.statusId ?? null) !== before.statusId;
        const after = await tx.passport.update({
          where: { id },
          data: {
            ...fields,
            statusId: data.statusId ?? null,
            ...(statusChanged && statusName
              ? { statusHistory: appendStatus(before.statusHistory, statusName, ctx.userId) }
              : {}),
          },
        });
        await recordAudit(tx, ctx, {
          action: "UPDATE",
          entity: "Passport",
          entityId: id,
          before,
          after,
        });
        return { id };
      }
      const p = await tx.passport.create({
        data: {
          agencyId: ctx.agencyId,
          ...fields,
          statusId: data.statusId ?? null,
          statusHistory: statusName ? appendStatus([], statusName, ctx.userId) : [],
          createdById: ctx.userId,
        },
      });
      await recordAudit(tx, ctx, {
        action: "CREATE",
        entity: "Passport",
        entityId: p.id,
        after: p,
      });
      return { id: p.id };
    });
  } catch (e) {
    if (isUniqueViolation(e))
      throw new ServiceError(`Passport ${data.passportNo} is already recorded`, {
        passportNo: "Already recorded",
      });
    throw e;
  }
}

export async function changePassportStatus(ctx: ServiceContext, id: string, input: unknown) {
  const data = passportStatusChangeSchema.parse(input);
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await tx.passport.findFirst({ where: { id } });
    if (!before) throw new NotFoundError("Passport");
    const name = await assertRefs(tx, { statusId: data.statusId });
    if (before.statusId === data.statusId)
      throw new ServiceError(`The passport is already ${name}`);
    const after = await tx.passport.update({
      where: { id },
      data: {
        statusId: data.statusId,
        statusHistory: appendStatus(before.statusHistory, name!, ctx.userId, data.note),
      },
    });
    await recordAudit(tx, ctx, {
      action: "UPDATE",
      entity: "Passport",
      entityId: id,
      before,
      after,
    });
  });
}

export async function setPassportActive(ctx: ServiceContext, id: string, active: boolean) {
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const before = await tx.passport.findFirst({ where: { id } });
    if (!before) throw new NotFoundError("Passport");
    const after = await tx.passport.update({ where: { id }, data: { isActive: active } });
    await recordAudit(tx, ctx, {
      action: active ? "ACTIVATE" : "DEACTIVATE",
      entity: "Passport",
      entityId: id,
      before,
      after,
    });
  });
}

export interface PassportListQuery extends ListParams {
  expiry?: ExpiryState;
  statusId?: string;
  clientId?: string;
}

export interface PassportRow {
  id: string;
  passportNo: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
  phone: string | null;
  expiryDate: string;
  expiry: ExpiryState;
  daysLeft: number;
  status: string | null;
  withUs: boolean;
  isActive: boolean;
  scans: number;
}

/** Where clause for an expiry state relative to today. */
function expiryWhere(state: ExpiryState, today: string): Prisma.PassportWhereInput {
  const warn = isoToDate(addMonthsIso(today, EXPIRY_WARNING_MONTHS));
  if (state === "EXPIRED") return { expiryDate: { lte: isoToDate(today) } };
  if (state === "SOON") return { expiryDate: { gt: isoToDate(today), lt: warn } };
  return { expiryDate: { gte: warn } };
}

export async function listPassports(ctx: ServiceContext, q: PassportListQuery, today: string) {
  const db = tenantDb(ctx.agencyId);
  const where: Prisma.PassportWhereInput = {};
  if (q.status === "active") where.isActive = true;
  else if (q.status === "inactive") where.isActive = false;
  if (q.expiry) Object.assign(where, expiryWhere(q.expiry, today));
  if (q.statusId) where.statusId = q.statusId;
  if (q.clientId) where.clientId = q.clientId;
  const text = q.q?.trim();
  if (text)
    where.OR = [
      { passportNo: { contains: text, mode: "insensitive" } },
      { name: { contains: text, mode: "insensitive" } },
      { phone: { contains: text } },
      { client: { name: { contains: text, mode: "insensitive" } } },
    ];
  const [rows, total] = await Promise.all([
    db.passport.findMany({
      where,
      include: {
        client: { select: { name: true } },
        status: { select: { name: true } },
        _count: { select: { attachments: true } },
      },
      orderBy: [{ expiryDate: "asc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    db.passport.count({ where }),
  ]);
  return {
    total,
    rows: rows.map((p): PassportRow => {
      const e = expiryState(dateToIso(p.expiryDate), today);
      return {
        id: p.id,
        passportNo: p.passportNo,
        name: p.name,
        clientId: p.clientId,
        clientName: p.client?.name ?? null,
        phone: p.phone,
        expiryDate: dateToIso(p.expiryDate),
        expiry: e.state,
        daysLeft: e.days,
        status: p.status?.name ?? null,
        withUs: !!p.receivedDate && !p.returnedDate,
        isActive: p.isActive,
        scans: p._count.attachments,
      };
    }),
  };
}

export type PassportList = Awaited<ReturnType<typeof listPassports>>;

export async function getPassport(ctx: ServiceContext, id: string, today: string) {
  const p = await tenantDb(ctx.agencyId).passport.findFirst({
    where: { id },
    include: {
      client: { select: { id: true, name: true, code: true } },
      status: { select: { id: true, name: true } },
      attachments: {
        select: { id: true, fileName: true, size: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!p) return null;
  const e = expiryState(dateToIso(p.expiryDate), today);
  return {
    id: p.id,
    passportNo: p.passportNo,
    name: p.name,
    client: p.client,
    gender: p.gender,
    dateOfBirth: iso(p.dateOfBirth),
    nationality: p.nationality,
    placeOfIssue: p.placeOfIssue,
    issueDate: iso(p.issueDate),
    expiryDate: dateToIso(p.expiryDate),
    expiry: e.state,
    daysLeft: e.days,
    phone: p.phone,
    status: p.status,
    statusHistory: (p.statusHistory as unknown as StatusEntry[]) ?? [],
    receivedDate: iso(p.receivedDate),
    returnedDate: iso(p.returnedDate),
    note: p.note,
    isActive: p.isActive,
    attachments: p.attachments.map((a) => ({ id: a.id, fileName: a.fileName, size: a.size })),
  };
}

export type PassportView = NonNullable<Awaited<ReturnType<typeof getPassport>>>;

export function passportFormValues(p: PassportView) {
  return {
    passportNo: p.passportNo,
    name: p.name,
    clientId: p.client?.id ?? null,
    gender: p.gender,
    dateOfBirth: p.dateOfBirth,
    nationality: p.nationality,
    placeOfIssue: p.placeOfIssue,
    issueDate: p.issueDate,
    expiryDate: p.expiryDate,
    phone: p.phone,
    statusId: p.status?.id ?? null,
    receivedDate: p.receivedDate,
    returnedDate: p.returnedDate,
    note: p.note,
  };
}

/** Active passports expired or expiring within 6 months (dashboard). */
export async function passportAlerts(ctx: ServiceContext, today: string) {
  const db = tenantDb(ctx.agencyId);
  const base = { isActive: true };
  const [expired, soon, list] = await Promise.all([
    db.passport.count({ where: { ...base, ...expiryWhere("EXPIRED", today) } }),
    db.passport.count({ where: { ...base, ...expiryWhere("SOON", today) } }),
    db.passport.findMany({
      where: { ...base, expiryDate: { lt: isoToDate(addMonthsIso(today, EXPIRY_WARNING_MONTHS)) } },
      orderBy: { expiryDate: "asc" },
      take: 8,
      include: { client: { select: { name: true } } },
    }),
  ]);
  return {
    expired,
    soon,
    list: list.map((p) => {
      const e = expiryState(dateToIso(p.expiryDate), today);
      return {
        id: p.id,
        passportNo: p.passportNo,
        name: p.name,
        clientName: p.client?.name ?? null,
        expiryDate: dateToIso(p.expiryDate),
        expiry: e.state,
        daysLeft: e.days,
      };
    }),
  };
}
