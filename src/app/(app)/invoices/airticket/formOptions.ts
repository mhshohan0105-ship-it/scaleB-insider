import "server-only";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "@/server/services/context";
import { listMoneyAccounts } from "@/server/services/accounts/moneyAccountService";
import { airPricingSettings } from "@/server/services/invoices/airInvoiceService";
import { masterOptions } from "@/server/services/masters/masterService";

/**
 * Lookups the air ticket invoice form needs. Money accounts only when the user
 * may take payments (the "Receive payment now" block).
 */
export async function airInvoiceFormOptions(ctx: ServiceContext, canReceive = false) {
  const [airlines, employees, pricing, accounts] = await Promise.all([
    masterOptions(ctx, "airlines"),
    masterOptions(ctx, "employees"),
    airPricingSettings(tenantDb(ctx.agencyId)),
    canReceive ? listMoneyAccounts(ctx, { activeOnly: true }) : Promise.resolve([]),
  ]);
  return {
    airlines,
    employees,
    pricing,
    accounts: accounts.map((a) => ({ value: a.id, label: a.name, kind: a.kind })),
  };
}
