import "server-only";
import { tenantDb } from "@/server/db/tenant";
import type { ServiceContext } from "@/server/services/context";
import { airPricingSettings } from "@/server/services/invoices/airInvoiceService";
import { masterOptions } from "@/server/services/masters/masterService";

/** Lookups the air ticket invoice form needs. */
export async function airInvoiceFormOptions(ctx: ServiceContext) {
  const [airlines, employees, pricing] = await Promise.all([
    masterOptions(ctx, "airlines"),
    masterOptions(ctx, "employees"),
    airPricingSettings(tenantDb(ctx.agencyId)),
  ]);
  return { airlines, employees, pricing };
}
