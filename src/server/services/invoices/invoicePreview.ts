// Invoice preview before saving: the invoice is created exactly as "Save &
// post" would (numbers, prices, payment, previous due) inside a transaction,
// read back into its printable shape, and then everything is rolled back, so
// nothing is saved and no number is used up.
import type { InvoiceTypeKey } from "@/lib/invoiceTypes";
import { tenantDb, type TenantTx } from "@/server/db/tenant";
import { loadInvoiceDocument } from "@/server/pdf/invoiceLoad";
import type { PdfInvoice } from "@/server/pdf/invoiceDocument";
import type { ServiceContext } from "../context";
import { ServiceError } from "../errors";
import { createAirInvoice } from "./airInvoiceService";
import { isItemInvoiceType, createItemInvoice } from "./itemInvoiceService";
import { createReissueInvoice } from "./reissueInvoiceService";
import { createVisaInvoice } from "./visaInvoiceService";

class RolledBack extends Error {}

function create(ctx: ServiceContext, type: InvoiceTypeKey, input: unknown, tx: TenantTx) {
  if (type === "AIR" || type === "NON_COMMISSION") return createAirInvoice(ctx, input, type, tx);
  if (type === "VISA") return createVisaInvoice(ctx, input, tx);
  if (type === "REISSUE") return createReissueInvoice(ctx, input, tx);
  if (isItemInvoiceType(type)) return createItemInvoice(ctx, type, input, tx);
  throw new ServiceError("This invoice type has no preview");
}

export async function previewInvoice(
  ctx: ServiceContext,
  type: InvoiceTypeKey,
  input: unknown,
): Promise<PdfInvoice> {
  const values = { ...(input as Record<string, unknown>), post: true };
  let doc: PdfInvoice | null = null;
  try {
    await tenantDb(ctx.agencyId).$transaction(
      async (tx) => {
        const { id } = await create(ctx, type, values, tx);
        doc = await loadInvoiceDocument(ctx, type, id, tx);
        throw new RolledBack();
      },
      { timeout: 30_000 },
    );
  } catch (e) {
    if (!(e instanceof RolledBack)) throw e;
  }
  if (!doc) throw new ServiceError("The preview could not be made");
  return { ...(doc as PdfInvoice), status: "PREVIEW" };
}
