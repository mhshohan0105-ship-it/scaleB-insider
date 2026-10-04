import { AccessDenied } from "@/components/ModulePlaceholder";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { chartOfAccounts, listMoneyAccounts } from "@/server/services/accounts/moneyAccountService";
import { listPeriods } from "@/server/services/accounts/periodService";
import { AccountsListPage } from "./AccountsListPage";

export default async function AccountsPage() {
  const user = await getUserContext();
  if (!can(user.permissions, "accounts", "view")) return <AccessDenied />;
  const ctx = await toServiceContext(user);
  const [accounts, ledgers, periods] = await Promise.all([
    listMoneyAccounts(ctx),
    chartOfAccounts(ctx),
    listPeriods(ctx),
  ]);
  return (
    <AccountsListPage
      accounts={accounts}
      ledgers={ledgers}
      periods={periods}
      canCreate={can(user.permissions, "accounts", "create")}
      canEdit={can(user.permissions, "accounts", "edit")}
    />
  );
}
