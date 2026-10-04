import "server-only";
// Page renderers shared by every refund type (history / new / view).
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/ModulePlaceholder";
import { RefundForm } from "@/components/refunds/RefundForm";
import { RefundList } from "@/components/refunds/RefundList";
import { RefundView } from "@/components/refunds/RefundView";
import { todayIso } from "@/lib/dates";
import { firstParam, parseListParams } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import type { RefundTypeKey } from "@/lib/refundTypes";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { listMoneyAccounts } from "@/server/services/accounts/moneyAccountService";
import { getRefund, listRefunds, refundTarget } from "@/server/services/refund/postRefund";
import type { RawSearchParams } from "../loadEntityPage";

async function access(action: "view" | "create") {
  const user = await getUserContext();
  return {
    user,
    allowed: can(user.permissions, "refund", action),
    ctx: await toServiceContext(user),
  };
}

export async function renderRefundList(
  type: RefundTypeKey,
  searchParams: Promise<RawSearchParams>,
) {
  const a = await access("view");
  if (!a.allowed) return <AccessDenied />;
  const params = parseListParams(await searchParams);
  const data = await listRefunds(a.ctx, type, params);
  return (
    <RefundList
      type={type}
      data={data}
      params={params}
      canCreate={can(a.user.permissions, "refund", "create")}
    />
  );
}

export async function renderNewRefund(type: RefundTypeKey, searchParams: Promise<RawSearchParams>) {
  const a = await access("create");
  if (!a.allowed) return <AccessDenied />;
  const invoiceId = firstParam((await searchParams).invoice);
  const [target, accounts] = await Promise.all([
    invoiceId ? refundTarget(a.ctx, type, invoiceId) : Promise.resolve(null),
    listMoneyAccounts(a.ctx, { activeOnly: true }),
  ]);
  return (
    <RefundForm
      type={type}
      today={todayIso()}
      initialTarget={target}
      accounts={accounts.map((x) => ({ value: x.id, label: x.name }))}
    />
  );
}

export async function renderRefundView(type: RefundTypeKey, id: string) {
  const a = await access("view");
  if (!a.allowed) return <AccessDenied />;
  const refund = await getRefund(a.ctx, id, type);
  if (!refund) notFound();
  return <RefundView refund={refund} canVoid={can(a.user.permissions, "refund", "void")} />;
}
