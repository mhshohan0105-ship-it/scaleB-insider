import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { ReceiptPdf } from "@/server/pdf/ReceiptPdf";
import { getMoneyReceipt } from "@/server/services/payments/receiptService";
import { getAppConfig, getProfile } from "@/server/services/settings/settingsService";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserContext();
  if (!can(user.permissions, "money_receipt", "view")) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const ctx = await toServiceContext(user);
  const [receipt, agency, config] = await Promise.all([
    getMoneyReceipt(ctx, id),
    getProfile(ctx),
    getAppConfig(ctx),
  ]);
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = await renderToBuffer(
    createElement(ReceiptPdf, { receipt, agency, footer: config.invoiceFooter }) as never,
  );
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${receipt.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
