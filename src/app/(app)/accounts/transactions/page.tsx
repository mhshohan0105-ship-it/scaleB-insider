import { AccessDenied } from "@/components/ModulePlaceholder";
import { firstParam, parseListParams } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { listMoneyAccounts } from "@/server/services/accounts/moneyAccountService";
import {
  SOURCE_TYPE_LABELS,
  transactionHistory,
} from "@/server/services/accounts/transactionHistory";
import type { RawSearchParams } from "../../loadEntityPage";
import { TransactionsPage } from "./TransactionsPage";

export default async function TransactionHistoryPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await getUserContext();
  if (!can(user.permissions, "accounts", "view")) return <AccessDenied />;
  const ctx = await toServiceContext(user);
  const raw = await searchParams;
  const params = parseListParams(raw);

  const accounts = await listMoneyAccounts(ctx);
  const accountParam = firstParam(raw.account);
  const account = accounts.find((a) => a.id === accountParam)?.id;
  const typeParam = firstParam(raw.type);
  const sourceType = typeParam && typeParam in SOURCE_TYPE_LABELS ? typeParam : undefined;

  const history = await transactionHistory(ctx, {
    page: params.page,
    pageSize: params.pageSize,
    moneyAccountId: account,
    from: params.from,
    to: params.to,
    sourceType,
  });

  return (
    <TransactionsPage
      history={history}
      params={params}
      account={account}
      sourceType={sourceType}
      accounts={accounts.map((a) => ({ value: a.id, label: a.name, balance: a.balance }))}
      sourceTypes={Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
    />
  );
}
