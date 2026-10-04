import { notFound, redirect } from "next/navigation";
import { AccessDenied } from "@/components/ModulePlaceholder";
import { can } from "@/lib/permissions";
import { REFUND_TYPE_INFO } from "@/lib/refundTypes";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { getRefund } from "@/server/services/refund/postRefund";

/** Short link to a refund (e.g. from a ledger line): opens it under its type. */
export default async function RefundLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserContext();
  if (!can(user.permissions, "refund", "view")) return <AccessDenied />;
  const refund = await getRefund(await toServiceContext(user), id);
  if (!refund) notFound();
  redirect(`${REFUND_TYPE_INFO[refund.type].path}/${id}`);
}
