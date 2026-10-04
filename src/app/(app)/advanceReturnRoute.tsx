import "server-only";
import { AccessDenied } from "@/components/ModulePlaceholder";
import { AdvanceReturnPage } from "@/components/payments/AdvanceReturnPage";
import { todayIso } from "@/lib/dates";
import { parseListParams } from "@/lib/listParams";
import { can, type ModuleKey } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { listMoneyAccounts } from "@/server/services/accounts/moneyAccountService";
import { listAdvanceReturns } from "@/server/services/payments/advanceReturnService";
import type { RawSearchParams } from "./loadEntityPage";
import {
  createClientAdvanceReturnAction,
  voidClientAdvanceReturnAction,
} from "./moneyreceipts/actions";
import {
  createVendorAdvanceReturnAction,
  voidVendorAdvanceReturnAction,
} from "./vendors/paymentActions";

/** Shared page for client and vendor advance returns. */
export async function renderAdvanceReturn(
  party: "clients" | "vendors",
  searchParams: Promise<RawSearchParams>,
) {
  const moduleKey: ModuleKey = party === "clients" ? "money_receipt" : "vendors";
  const user = await getUserContext();
  if (!can(user.permissions, moduleKey, "view")) return <AccessDenied />;
  const ctx = await toServiceContext(user);
  const params = parseListParams(await searchParams);
  const [accounts, returns] = await Promise.all([
    listMoneyAccounts(ctx, { activeOnly: true }),
    listAdvanceReturns(ctx, party === "clients" ? "CLIENT" : "VENDOR", params),
  ]);
  return (
    <AdvanceReturnPage
      party={party}
      accounts={accounts.map((a) => ({
        value: a.id,
        label: a.name,
        kind: a.kind,
        balance: a.balance,
      }))}
      returns={returns}
      params={params}
      today={todayIso()}
      canCreate={can(user.permissions, moduleKey, "create")}
      canVoid={can(user.permissions, moduleKey, "void")}
      onCreate={
        party === "clients" ? createClientAdvanceReturnAction : createVendorAdvanceReturnAction
      }
      onVoid={party === "clients" ? voidClientAdvanceReturnAction : voidVendorAdvanceReturnAction}
    />
  );
}
