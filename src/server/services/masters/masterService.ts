// Generic CRUD for every list described in src/lib/masters.ts and
// src/lib/parties.ts (configuration masters and parties).
import { Prisma } from "@prisma/client";
import { ENTITIES } from "@/lib/entities";
import {
  masterSchema,
  refLabelKey,
  type EntityKey,
  type FieldOption,
  type MasterDef,
} from "@/lib/masters";
import { recordAudit } from "@/server/audit/audit";
import { tenantDb, type TenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { NotFoundError, ServiceError, isUniqueViolation } from "../errors";
import { formatNumber, nextSequence } from "../numbering/sequence";
import { syncPartyOpening, type PartyOpening } from "@/server/accounting/opening";
import type { PartyKey } from "@/lib/masters";
import { toPlain } from "../serialize";
import { linkCombinedAccounts } from "../parties/combinedService";

type Row = Record<string, unknown> & { id: string };

interface Delegate {
  findMany(args: unknown): Promise<Row[]>;
  findFirst(args: unknown): Promise<Row | null>;
  count(args: unknown): Promise<number>;
  create(args: unknown): Promise<Row>;
  update(args: unknown): Promise<Row>;
}

function delegate(db: TenantDb | TenantTx, model: string): Delegate {
  const d = (db as unknown as Record<string, Delegate | undefined>)[model];
  if (!d) throw new Error(`Unknown model delegate "${model}"`);
  return d;
}

function entityName(def: MasterDef) {
  return def.model.charAt(0).toUpperCase() + def.model.slice(1);
}

export type MasterStatusFilter = "active" | "inactive" | "all";

export interface MasterListParams {
  page: number;
  pageSize: number;
  q?: string;
  status?: MasterStatusFilter;
}

export type MasterRow = Record<string, string | number | boolean | null> & {
  id: string;
  isActive: boolean;
};

export interface MasterList {
  rows: MasterRow[];
  total: number;
}

function buildWhere(def: MasterDef, q?: string, status: MasterStatusFilter = "active") {
  const where: Record<string, unknown> = {};
  if (status !== "all") where.isActive = status === "active";
  const term = q?.trim();
  if (term) {
    where.OR = def.searchFields.map((f) => ({ [f]: { contains: term, mode: "insensitive" } }));
  }
  return where;
}

function refInclude(def: MasterDef) {
  const include: Record<string, unknown> = {};
  for (const f of def.fields) {
    if (f.type === "ref" && f.relation)
      include[f.relation] = {
        select: { name: true, ...(def.netWithRefs?.includes(f.relation) ? { balance: true } : {}) },
      };
  }
  return Object.keys(include).length ? { include } : {};
}

/** Converts a DB row into a client safe row (decimals/dates as strings, ref labels). */
function toRow(def: MasterDef, row: Row): MasterRow {
  const out: MasterRow = { id: row.id, isActive: Boolean(row.isActive) };
  if (def.codePrefix) out.code = String(row.code);
  if (def.balance) out.balance = toPlain(row.balance as Prisma.Decimal);
  for (const f of def.fields) {
    const v = toPlain(row[f.name]);
    out[f.name] = (v ?? null) as string | number | boolean | null;
    if (f.type === "ref" && f.relation) {
      const rel = row[f.relation] as { name?: string } | null | undefined;
      out[refLabelKey(f.name)] = rel?.name ?? null;
    }
  }
  if (def.balance && def.netWithRefs) {
    // Shown balance = own + linked parties; each part is kept for the profile.
    let net = new Prisma.Decimal((row.balance as Prisma.Decimal | null) ?? 0);
    out.ownBalance = net.toFixed(2);
    for (const rel of def.netWithRefs) {
      const b = (row[rel] as { balance?: Prisma.Decimal } | null | undefined)?.balance;
      out[`${rel}Balance`] = b ? new Prisma.Decimal(b).toFixed(2) : null;
      if (b) net = net.plus(b);
    }
    out.balance = net.toFixed(2);
  }
  return out;
}

export async function listMasters(
  ctx: ServiceContext,
  key: EntityKey,
  params: MasterListParams,
): Promise<MasterList> {
  const def = ENTITIES[key];
  const d = delegate(tenantDb(ctx.agencyId), def.model);
  const where = buildWhere(def, params.q, params.status);

  const [rows, total] = await Promise.all([
    d.findMany({
      where,
      orderBy: [{ [def.orderBy]: "asc" }, { id: "asc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      ...refInclude(def),
    }),
    d.count({ where }),
  ]);

  return { total, rows: rows.map((row) => toRow(def, row)) };
}

/** One row (any status) for a profile page, or null when it does not exist in this tenant. */
export async function getEntity(
  ctx: ServiceContext,
  key: EntityKey,
  id: string,
): Promise<MasterRow | null> {
  const def = ENTITIES[key];
  const row = await delegate(tenantDb(ctx.agencyId), def.model).findFirst({
    where: { id },
    ...refInclude(def),
  });
  return row ? toRow(def, row) : null;
}

function optionLabel(key: EntityKey, def: MasterDef, r: Row): string {
  if (key === "airports" || key === "airlines") return `${r.iata} · ${r.name}`;
  if (def.codePrefix) return `${r.name} (${r.code})`;
  return String(r.name);
}

/** Active rows as select options (small lists: configuration masters). */
export async function masterOptions(ctx: ServiceContext, key: EntityKey): Promise<FieldOption[]> {
  const def = ENTITIES[key];
  const rows = await delegate(tenantDb(ctx.agencyId), def.model).findMany({
    where: { isActive: true },
    orderBy: { [def.orderBy]: "asc" },
    take: 2000,
  });
  return rows.map((r) => ({ value: r.id, label: optionLabel(key, def, r) }));
}

/** Type-ahead search for large lists (parties). Always includes `includeId` if given. */
export async function searchEntityOptions(
  ctx: ServiceContext,
  key: EntityKey,
  q: string,
  includeId?: string | null,
  take = 20,
): Promise<(FieldOption & { phone?: string | null })[]> {
  const def = ENTITIES[key];
  const d = delegate(tenantDb(ctx.agencyId), def.model);
  const rows = await d.findMany({
    where: buildWhere(def, q, "active"),
    orderBy: [{ [def.orderBy]: "asc" }, { id: "asc" }],
    take,
  });
  if (includeId && !rows.some((r) => r.id === includeId)) {
    const current = await d.findFirst({ where: { id: includeId } });
    if (current) rows.unshift(current);
  }
  return rows.map((r) => ({
    value: r.id,
    label: optionLabel(key, def, r),
    phone: (r.phone as string | null | undefined) ?? null,
  }));
}

function toData(def: MasterDef, parsed: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const f of def.fields) {
    const v = parsed[f.name];
    if ((f.type === "money" || f.type === "percent") && v !== null && v !== undefined) {
      data[f.name] = new Prisma.Decimal(v as string);
    } else {
      data[f.name] = v ?? null;
    }
  }
  return data;
}

async function assertRefsOwned(tx: TenantTx, def: MasterDef, data: Record<string, unknown>) {
  for (const f of def.fields) {
    const id = data[f.name];
    if (f.type !== "ref" || !f.ref || typeof id !== "string") continue;
    const found = await delegate(tx, ENTITIES[f.ref].model).findFirst({
      where: { id },
      select: { id: true },
    });
    if (!found) {
      throw new ServiceError(`${f.label} not found`, { [f.name]: `Choose a valid ${f.label}` });
    }
  }
}

function uniqueError(def: MasterDef, error: Prisma.PrismaClientKnownRequestError): ServiceError {
  const target = error.meta?.target;
  const fields = Array.isArray(target) ? (target as string[]) : [];
  const field = def.fields.find((f) => fields.includes(f.name)) ?? def.fields[0]!;
  return new ServiceError(
    `A ${def.singular.toLowerCase()} with this ${field.label.toLowerCase()} already exists`,
    { [field.name]: `${field.label} already exists` },
  );
}

function openingChanged(before: Row, after: Row): boolean {
  return (
    String(before.openingBalance) !== String(after.openingBalance) ||
    before.openingBalanceType !== after.openingBalanceType
  );
}

/** Creates (id = null) or updates a row. */
export async function saveMaster(
  ctx: ServiceContext,
  key: EntityKey,
  id: string | null,
  input: unknown,
): Promise<{ id: string }> {
  const def = ENTITIES[key];
  const parsed = masterSchema(def).parse(input) as Record<string, unknown>;
  const data = toData(def, parsed);
  const entity = entityName(def);

  try {
    return await tenantDb(ctx.agencyId).$transaction(async (tx) => {
      await assertRefsOwned(tx, def, data);
      const d = delegate(tx, def.model);

      if (id) {
        const before = await d.findFirst({ where: { id } });
        if (!before) throw new NotFoundError(def.singular);
        const after = await d.update({ where: { id }, data });
        if (def.key === "combinedclients") await linkCombinedAccounts(tx, ctx, id);
        if (def.balance && openingChanged(before, after)) {
          // Reverse the old opening entry and post the new one.
          await syncPartyOpening(tx, ctx, def.key as PartyKey, after as unknown as PartyOpening);
        }
        await recordAudit(tx, ctx, { action: "UPDATE", entity, entityId: id, before, after });
        return { id };
      }

      const create: Record<string, unknown> = { ...data, createdById: ctx.userId };
      if (def.codePrefix) {
        const n = await nextSequence(tx, ctx.agencyId, `PARTY_${def.key.toUpperCase()}`);
        create.code = formatNumber(def.codePrefix, n);
      }
      const created = await d.create({ data: create });
      if (def.key === "combinedclients") await linkCombinedAccounts(tx, ctx, created.id);
      if (def.balance) {
        // Posts the opening entry; the posting engine moves the cached balance.
        await syncPartyOpening(tx, ctx, def.key as PartyKey, created as unknown as PartyOpening);
      }
      await recordAudit(tx, ctx, {
        action: "CREATE",
        entity,
        entityId: created.id,
        after: created,
      });
      return { id: created.id };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw uniqueError(def, error);
    throw error;
  }
}

export async function setMasterActive(
  ctx: ServiceContext,
  key: EntityKey,
  id: string,
  active: boolean,
): Promise<void> {
  const def = ENTITIES[key];
  await tenantDb(ctx.agencyId).$transaction(async (tx) => {
    const d = delegate(tx, def.model);
    const before = await d.findFirst({ where: { id } });
    if (!before) throw new NotFoundError(def.singular);
    if (before.isActive === active) return;
    const after = await d.update({ where: { id }, data: { isActive: active } });
    await recordAudit(tx, ctx, {
      action: active ? "ACTIVATE" : "DEACTIVATE",
      entity: entityName(def),
      entityId: id,
      before,
      after,
    });
  });
}
