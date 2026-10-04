import { AccessDenied } from "@/components/ModulePlaceholder";
import { PayrollPage } from "@/components/payroll/PayrollPage";
import { todayIso } from "@/lib/dates";
import { firstParam, parseListParams } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { listMoneyAccounts } from "@/server/services/accounts/moneyAccountService";
import { masterOptions } from "@/server/services/masters/masterService";
import { listPayrolls } from "@/server/services/payroll/payrollService";
import type { RawSearchParams } from "../loadEntityPage";

export default async function PayrollRoute({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await getUserContext();
  if (!can(user.permissions, "payroll", "view")) return <AccessDenied />;
  const ctx = await toServiceContext(user);
  const raw = await searchParams;
  const params = parseListParams(raw);
  const monthText = firstParam(raw.month);
  const month = monthText && /^\d{4}-\d{2}$/.test(monthText) ? monthText : undefined;
  const [data, employees, accounts] = await Promise.all([
    listPayrolls(ctx, { ...params, month }),
    masterOptions(ctx, "employees"),
    listMoneyAccounts(ctx, { activeOnly: true }),
  ]);
  return (
    <PayrollPage
      data={data}
      params={params}
      month={month}
      employees={employees}
      accounts={accounts.map((a) => ({ value: a.id, label: a.name }))}
      canCreate={can(user.permissions, "payroll", "create")}
      canVoid={can(user.permissions, "payroll", "void")}
      today={todayIso()}
    />
  );
}
