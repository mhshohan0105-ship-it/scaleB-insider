import { NextResponse } from "next/server";
import { INVOICE_TYPE_INFO } from "@/lib/invoiceTypes";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { loadInvoiceDocument } from "@/server/pdf/invoiceLoad";
import { renderInvoicePdf } from "@/server/pdf/invoicePdfFile";
import { invoiceTypeOf } from "@/server/services/invoices/invoiceCommon";

// PDFs, exports and nightly jobs can take longer than the platform default.
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const download = new URL(req.url).searchParams.get("download") === "1";
  const user = await getUserContext();
  const ctx = await toServiceContext(user);
  const type = await invoiceTypeOf(ctx, id);
  if (!type) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(user.permissions, INVOICE_TYPE_INFO[type].module, "view")) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const invoice = await loadInvoiceDocument(ctx, type, id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = await renderInvoicePdf(ctx, invoice, id);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // ?download=1 saves the file instead of opening it in the browser.
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${invoice.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
