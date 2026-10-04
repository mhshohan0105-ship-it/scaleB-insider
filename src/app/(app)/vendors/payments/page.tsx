import { AccessDenied } from "@/components/ModulePlaceholder";
import { todayIso } from "@/lib/dates";
import { parseListParams } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { listMoneyAccounts } from "@/server/services/accounts/moneyAccountService";
import { listVendorPayments } from "@/server/services/payments/vendorPaymentService";
import type { RawSearchParams } from "../../loadEntityPage";
import { VendorPaymentsPage } from "./VendorPaymentsPage";

export default async function VendorPaymentsRoute({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await getUserContext();
  if (!can(user.permissions, "vendors", "view")) return <AccessDenied />;
  const ctx = await toServiceContext(user);
  const params = parseListParams(await searchParams);
  const [accounts, payments] = await Promise.all([
    listMoneyAccounts(ctx, { activeOnly: true }),
    listVendorPayments(ctx, params),
  ]);
  return (
    <VendorPaymentsPage
      accounts={accounts.map((a) => ({
        value: a.id,
        label: a.name,
        kind: a.kind,
        balance: a.balance,
      }))}
      payments={payments}
      params={params}
      today={todayIso()}
      canCreate={can(user.permissions, "vendors", "create")}
      canVoid={can(user.permissions, "vendors", "void")}
    />
  );
}
