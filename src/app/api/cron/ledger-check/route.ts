// Nightly ledger check (PLAN.md 2.2): for every agency, confirm debits =
// credits and every cached balance equals the ledger. Problems are written to
// the audit trail. Call with: Authorization: Bearer <CRON_SECRET>.
import { NextResponse, type NextRequest } from "next/server";
import { checkLedgerIntegrity, isHealthy } from "@/server/accounting/balances";
import { prisma } from "@/server/db/prisma";
import { tenantDb } from "@/server/db/tenant";
import { notify } from "@/server/services/notifications/notificationService";
import { cronAuthorised as authorised } from "@/server/cron/auth";

export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const agencies = await prisma.agency.findMany({
    where: { status: { not: "SUSPENDED" } },
    select: { id: true, code: true },
  });
  const problems: { agency: string; unbalancedEntries: number; drift: number }[] = [];
  for (const a of agencies) {
    const db = tenantDb(a.id);
    const result = await checkLedgerIntegrity(db, a.id);
    if (isHealthy(result)) continue;
    problems.push({
      agency: a.code,
      unbalancedEntries: result.unbalancedEntries.length,
      drift: result.drift.length,
    });
    await db.auditLog.create({
      data: {
        agencyId: a.id,
        action: "LEDGER_DRIFT",
        entity: "Ledger",
        after: JSON.parse(JSON.stringify(result)),
      },
    });
    await notify(a.id, {
      module: "accounts",
      kind: "LEDGER_DRIFT",
      title: "The nightly ledger check found a problem",
      body: `${result.unbalancedEntries.length} unbalanced entries, ${result.drift.length} balance differences`,
      link: "/dashboard",
    });
  }
  return NextResponse.json({ checked: agencies.length, problems });
}
