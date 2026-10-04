import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { PayslipPdf } from "@/server/pdf/PayslipPdf";
import { getPayroll } from "@/server/services/payroll/payrollService";
import { getProfile } from "@/server/services/settings/settingsService";

// PDFs, exports and nightly jobs can take longer than the platform default.
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserContext();
  if (!can(user.permissions, "payroll", "view")) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const ctx = await toServiceContext(user);
  const [payroll, agency] = await Promise.all([getPayroll(ctx, id), getProfile(ctx)]);
  if (!payroll) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pdf = await renderToBuffer(createElement(PayslipPdf, { payroll, agency }) as never);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${payroll.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
