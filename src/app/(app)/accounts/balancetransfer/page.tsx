import { AccessDenied } from "@/components/ModulePlaceholder";
import { todayIso } from "@/lib/dates";
import { parseListParams } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { listMoneyAccounts } from "@/server/services/accounts/moneyAccountService";
import { listBalanceTransfers } from "@/server/services/accounts/transferService";
import type { RawSearchParams } from "../../loadEntityPage";
import { BalanceTransferPage } from "./BalanceTransferPage";

export default async function BalanceTransferRoute({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await getUserContext();
  if (!can(user.permissions, "accounts", "view")) return <AccessDenied />;
  const ctx = await toServiceContext(user);
  const params = parseListParams(await searchParams);
  const [accounts, transfers] = await Promise.all([
    listMoneyAccounts(ctx, { activeOnly: true }),
    listBalanceTransfers(ctx, params),
  ]);
  return (
    <BalanceTransferPage
      accounts={accounts.map((a) => ({
        value: a.id,
        label: a.name,
        balance: a.balance,
        kind: a.kind,
      }))}
      transfers={transfers}
      params={params}
      today={todayIso()}
      canCreate={can(user.permissions, "accounts", "create")}
      canVoid={can(user.permissions, "accounts", "void")}
    />
  );
}
