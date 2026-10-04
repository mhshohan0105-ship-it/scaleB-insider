import { notFound, redirect } from "next/navigation";
import { AccessDenied } from "@/components/ModulePlaceholder";
import { can } from "@/lib/permissions";
import { VOUCHER_KIND_INFO } from "@/lib/voucherKinds";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { tenantDb } from "@/server/db/tenant";

/** Short link to a voucher (e.g. from a ledger line): opens its page, filtered to it. */
export default async function VoucherLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserContext();
  const ctx = await toServiceContext(user);
  const v = await tenantDb(ctx.agencyId).voucher.findFirst({
    where: { id },
    select: { kind: true, number: true },
  });
  if (!v) notFound();
  const info = VOUCHER_KIND_INFO[v.kind];
  if (!can(user.permissions, info.module, "view")) return <AccessDenied />;
  redirect(`${info.path}?q=${encodeURIComponent(v.number)}`);
}
