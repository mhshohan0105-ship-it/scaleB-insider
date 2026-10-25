// Images a printed invoice needs: the agency's logo and seal, and the QR code
// for the invoice's verification link (each only when present and switched on).
import { getAgencyImage } from "@/server/services/agency/brandingService";
import type { ServiceContext } from "@/server/services/context";
import { ensurePublicToken, qrPng, verifyUrl } from "@/server/services/invoices/publicInvoice";
import type { AgencyProfile } from "@/server/services/settings/settingsService";
import type { InvoiceBranding, PdfImage } from "./InvoicePdf";

function pdfImage(img: { mimeType: string; data: Uint8Array } | null): PdfImage | null {
  if (!img) return null;
  return { data: Buffer.from(img.data), format: img.mimeType === "image/png" ? "png" : "jpg" };
}

export async function invoiceBranding(
  ctx: ServiceContext,
  agency: AgencyProfile,
  invoiceId: string,
  status: string,
): Promise<InvoiceBranding> {
  const wantQr = agency.pdf.showQr && status !== "DRAFT";
  const [logo, seal, qr] = await Promise.all([
    agency.images.LOGO ? getAgencyImage(ctx, "LOGO") : null,
    agency.images.SEAL ? getAgencyImage(ctx, "SEAL") : null,
    wantQr ? ensurePublicToken(ctx, invoiceId).then((t) => qrPng(verifyUrl(t))) : null,
  ]);
  return { logo: pdfImage(logo), seal: pdfImage(seal), qr, options: agency.pdf };
}
