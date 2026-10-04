import { AccessDenied } from "@/components/ModulePlaceholder";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { balanceStatus } from "@/server/services/accounts/moneyAccountService";
import { BalanceStatusView } from "./BalanceStatusView";

export default async function BalanceStatusPage() {
  const user = await getUserContext();
  if (!can(user.permissions, "accounts", "view")) return <AccessDenied />;
  const status = await balanceStatus(await toServiceContext(user));
  return <BalanceStatusView status={status} />;
}
