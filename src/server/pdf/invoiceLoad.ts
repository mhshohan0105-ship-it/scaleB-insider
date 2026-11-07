// Reads any invoice type into the printable shape (PdfInvoice), with a given
// client: the tenant client, or a transaction for the preview before saving.
import { INVOICE_TYPE_INFO, type InvoiceTypeKey } from "@/lib/invoiceTypes";
import { tenantDb, type TenantDb, type TenantTx } from "@/server/db/tenant";
import type { ServiceContext } from "@/server/services/context";
import { getAirInvoice } from "@/server/services/invoices/airInvoiceService";
import { getItemInvoice } from "@/server/services/invoices/itemInvoiceService";
import { getReissueInvoice } from "@/server/services/invoices/reissueInvoiceService";
import { getVisaInvoice } from "@/server/services/invoices/visaInvoiceService";
import {
  itemDocument,
  reissueDocument,
  ticketDocument,
  visaDocument,
  type PdfInvoice,
} from "./invoiceDocument";

type Db = TenantDb | TenantTx;

/** The invoice in its printable shape, read with `db` (a transaction for previews). */
export async function loadInvoiceDocument(
  ctx: ServiceContext,
  type: InvoiceTypeKey,
  id: string,
  db: Db = tenantDb(ctx.agencyId),
): Promise<PdfInvoice | null> {
  let doc: PdfInvoice | null = null;
  if (type === "AIR" || type === "NON_COMMISSION") {
    const inv = await getAirInvoice(ctx, id, type, db);
    doc = inv && ticketDocument(inv);
  } else if (type === "REISSUE") {
    const inv = await getReissueInvoice(ctx, id, db);
    doc = inv && reissueDocument(inv);
  } else if (type === "VISA") {
    const inv = await getVisaInvoice(ctx, id, db);
    doc = inv && visaDocument(inv);
  } else if (INVOICE_TYPE_INFO[type].lines === "item") {
    const inv = await getItemInvoice(ctx, type, id, db);
    doc = inv && itemDocument(inv);
  }
  if (doc?.showPrevDue) doc.previousDue = await previousDue(db, id, doc.due);
  return doc;
}

/** What the client owed before this invoice (cached balance less this invoice's due). */
async function previousDue(db: Db, invoiceId: string, due: string) {
  const inv = await db.invoice.findFirst({ where: { id: invoiceId }, select: { clientId: true } });
  const client = inv
    ? await db.client.findFirst({ where: { id: inv.clientId }, select: { balance: true } })
    : null;
  if (!client) return null;
  const before = client.balance.minus(due);
  return before.greaterThan(0) ? before.toFixed(2) : "0.00";
}
