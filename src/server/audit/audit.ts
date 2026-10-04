// Audit trail writer (PLAN.md 2.4). Call inside the same transaction as the change.
import type { Prisma } from "@prisma/client";
import type { TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "@/server/services/context";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "ACTIVATE"
  | "DEACTIVATE"
  | "VOID"
  | "LOGIN"
  | "PASSWORD_RESET"
  | "PASSWORD_CHANGE"
  | "EXPORT"
  | "LEDGER_DRIFT";

const SECRET_KEYS = new Set(["passwordHash", "password"]);

/** Makes a value JSON safe for the audit columns and drops secrets. */
export function toAuditJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(
    JSON.stringify(value, (key, v: unknown) => (SECRET_KEYS.has(key) ? undefined : v)),
  ) as Prisma.InputJsonValue;
}

export async function recordAudit(
  tx: TenantTx,
  ctx: ServiceContext,
  entry: {
    action: AuditAction;
    entity: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
  },
) {
  await tx.auditLog.create({
    data: {
      agencyId: ctx.agencyId,
      userId: ctx.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: toAuditJson(entry.before),
      after: toAuditJson(entry.after),
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    },
  });
}
