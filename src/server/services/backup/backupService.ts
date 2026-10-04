// Tenant data export (Configuration > Database Backup). Full database backups
// are handled at the infrastructure level (PLAN.md section 8).
import { Prisma } from "@prisma/client";
import { recordAudit } from "@/server/audit/audit";
import { prisma } from "@/server/db/prisma";
import { TENANT_MODELS, tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { toPlain } from "../serialize";

/** Never exported, whatever the model. */
const REDACTED_FIELDS = new Set(["passwordHash"]);

function delegateName(model: string) {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

export async function exportTenantData(ctx: ServiceContext) {
  const db = tenantDb(ctx.agencyId);
  const agency = await prisma.agency.findUnique({ where: { id: ctx.agencyId } });

  const tables: Record<string, unknown[]> = {};
  const models = Prisma.dmmf.datamodel.models.filter((m) => TENANT_MODELS.has(m.name));
  for (const model of models) {
    const d = (
      db as unknown as Record<string, { findMany(a: unknown): Promise<Record<string, unknown>[]> }>
    )[delegateName(model.name)];
    if (!d) continue;
    const rows = await d.findMany({ orderBy: { id: "asc" } });
    tables[model.name] = rows.map((row) => {
      const copy = { ...row };
      for (const f of REDACTED_FIELDS) delete copy[f];
      return toPlain(copy);
    });
  }

  await db.$transaction((tx) =>
    recordAudit(tx, ctx, { action: "EXPORT", entity: "Backup", entityId: ctx.agencyId }),
  );

  return {
    format: "scaleb-insider-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    agency: toPlain(agency),
    tables,
  };
}
