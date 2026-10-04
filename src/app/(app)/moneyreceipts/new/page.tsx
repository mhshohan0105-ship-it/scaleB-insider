import { AccessDenied } from "@/components/ModulePlaceholder";
import { todayIso } from "@/lib/dates";
import { firstParam } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { listMoneyAccounts } from "@/server/services/accounts/moneyAccountService";
import type { RawSearchParams } from "../../loadEntityPage";
import { ReceiptForm } from "./ReceiptForm";

export default async function NewMoneyReceiptPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await getUserContext();
  if (!can(user.permissions, "money_receipt", "create")) return <AccessDenied />;
  const accounts = await listMoneyAccounts(await toServiceContext(user), { activeOnly: true });
  const client = firstParam((await searchParams).client);
  return (
    <ReceiptForm
      today={todayIso()}
      initialClientId={client ?? null}
      accounts={accounts.map((a) => ({ value: a.id, label: a.name, kind: a.kind }))}
    />
  );
}
