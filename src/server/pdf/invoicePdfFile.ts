// Renders the printable invoice with the agency's details, images and terms.
// Used by the PDF route and by the preview before saving.
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import type { ServiceContext } from "@/server/services/context";
import { getAppConfig, getProfile } from "@/server/services/settings/settingsService";
import { invoiceBranding } from "./branding";
import { InvoicePdf } from "./InvoicePdf";
import type { PdfInvoice } from "./invoiceDocument";

/** Renders an invoice document with the agency's details, images and terms. */
export async function renderInvoicePdf(
  ctx: ServiceContext,
  invoice: PdfInvoice,
  invoiceId: string | null,
): Promise<Buffer> {
  const [agency, config] = await Promise.all([getProfile(ctx), getAppConfig(ctx)]);
  const branding = await invoiceBranding(ctx, agency, invoiceId, invoice.status);
  return renderToBuffer(
    createElement(InvoicePdf, {
      invoice,
      agency,
      branding,
      terms: config.invoiceTerms,
      footer: config.invoiceFooter,
    }) as never,
  );
}
