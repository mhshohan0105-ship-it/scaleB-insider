// Year based document numbers using the agency's configured prefixes,
// e.g. "BT-2026-00001" (PLAN.md 2.3).
import { resolvePrefixes, type DocumentTypeKey } from "@/lib/documentPrefixes";
import type { TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "../context";
import { formatNumber, nextSequence } from "./sequence";

/** Next number for a document type in the year of `dateIso` ("YYYY-MM-DD"). Call inside the saving transaction. */
export async function documentNumber(
  tx: TenantTx,
  ctx: ServiceContext,
  docType: DocumentTypeKey,
  dateIso: string,
): Promise<string> {
  const year = Number(dateIso.slice(0, 4));
  const setting = await tx.agencySetting.findFirst({ select: { invoicePrefixes: true } });
  const prefix = resolvePrefixes(setting?.invoicePrefixes)[docType];
  const n = await nextSequence(tx, ctx.agencyId, docType, year);
  return formatNumber(prefix, n, year);
}
