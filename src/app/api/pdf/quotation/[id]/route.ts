import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { todayIso } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { QuotationPdf } from "@/server/pdf/QuotationPdf";
import { getQuotation } from "@/server/services/quotations/quotationService";
import { getAppConfig, getProfile } from "@/server/services/settings/settingsService";

// PDFs, exports and nightly jobs can take longer than the platform default.
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserContext();
  if (!can(user.permissions, "quotation", "view")) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const ctx = await toServiceContext(user);
  const [q, agency, config] = await Promise.all([
    getQuotation(ctx, id, todayIso()),
    getProfile(ctx),
    getAppConfig(ctx),
  ]);
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pdf = await renderToBuffer(
    createElement(QuotationPdf, { q, agency, footer: config.invoiceFooter }) as never,
  );
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${q.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
