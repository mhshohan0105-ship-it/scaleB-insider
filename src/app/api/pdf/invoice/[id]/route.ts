import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { INVOICE_TYPE_INFO, type InvoiceTypeKey } from "@/lib/invoiceTypes";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { InvoicePdf } from "@/server/pdf/InvoicePdf";
import {
  itemDocument,
  reissueDocument,
  ticketDocument,
  visaDocument,
  type PdfInvoice,
} from "@/server/pdf/invoiceDocument";
import type { ServiceContext } from "@/server/services/context";
import { getAirInvoice } from "@/server/services/invoices/airInvoiceService";
import { invoiceTypeOf } from "@/server/services/invoices/invoiceCommon";
import { getItemInvoice } from "@/server/services/invoices/itemInvoiceService";
import { getReissueInvoice } from "@/server/services/invoices/reissueInvoiceService";
import { getVisaInvoice } from "@/server/services/invoices/visaInvoiceService";
import { getAppConfig, getProfile } from "@/server/services/settings/settingsService";

// PDFs, exports and nightly jobs can take longer than the platform default.
export const maxDuration = 60;

async function loadDocument(
  ctx: ServiceContext,
  type: InvoiceTypeKey,
  id: string,
): Promise<PdfInvoice | null> {
  if (type === "AIR" || type === "NON_COMMISSION") {
    const inv = await getAirInvoice(ctx, id, type);
    return inv && ticketDocument(inv);
  }
  if (type === "REISSUE") {
    const inv = await getReissueInvoice(ctx, id);
    return inv && reissueDocument(inv);
  }
  if (type === "VISA") {
    const inv = await getVisaInvoice(ctx, id);
    return inv && visaDocument(inv);
  }
  if (INVOICE_TYPE_INFO[type].lines === "item") {
    const inv = await getItemInvoice(ctx, type, id);
    return inv && itemDocument(inv);
  }
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserContext();
  const ctx = await toServiceContext(user);
  const type = await invoiceTypeOf(ctx, id);
  if (!type) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(user.permissions, INVOICE_TYPE_INFO[type].module, "view")) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const [invoice, agency, config] = await Promise.all([
    loadDocument(ctx, type, id),
    getProfile(ctx),
    getAppConfig(ctx),
  ]);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = await renderToBuffer(
    createElement(InvoicePdf, {
      invoice,
      agency,
      terms: config.invoiceTerms,
      footer: config.invoiceFooter,
    }) as never,
  );
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
