import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { can } from "@/lib/permissions";
import { getUserContext } from "@/server/auth/session";
import { SubscriptionReceiptPdf } from "@/server/pdf/SubscriptionReceiptPdf";
import { getProfile } from "@/server/services/settings/settingsService";
import { subscriptionPaymentForReceipt } from "@/server/services/subscription/paymentService";
import { planByCode, platformAgency } from "@/server/services/subscription/subscriptionService";

export const maxDuration = 60;

/** Receipt for a subscription payment: the agency's own, or any for a platform admin. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserContext();
  if (!user.isSuperAdmin && !can(user.permissions, "configuration", "view"))
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const [payment, platform] = await Promise.all([
    subscriptionPaymentForReceipt(user.agencyId, id, user.isSuperAdmin),
    platformAgency(),
  ]);
  if (!payment || !platform) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [issuer, plan] = await Promise.all([
    getProfile({ agencyId: platform.id, userId: null }),
    planByCode(payment.plan),
  ]);

  const pdf = await renderToBuffer(
    createElement(SubscriptionReceiptPdf, { payment, issuer, planName: plan.name }) as never,
  );
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${payment.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
