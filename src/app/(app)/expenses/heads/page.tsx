import { AccessDenied } from "@/components/ModulePlaceholder";
import { ExpenseHeadsPage } from "@/components/vouchers/ExpenseHeadsPage";
import { fiscalYear, todayIso } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { listExpenseHeads } from "@/server/services/expense/expenseHeadService";
import { getAppConfig } from "@/server/services/settings/settingsService";

export default async function ExpenseHeadsRoute() {
  const user = await getUserContext();
  if (!can(user.permissions, "expense", "view")) return <AccessDenied />;
  const ctx = await toServiceContext(user);
  const fy = fiscalYear(todayIso(), (await getAppConfig(ctx)).fiscalYearStart);
  return (
    <ExpenseHeadsPage
      heads={await listExpenseHeads(ctx, fy.from)}
      canCreate={can(user.permissions, "expense", "create")}
      canEdit={can(user.permissions, "expense", "edit")}
      fiscalYearLabel={fy.label}
    />
  );
}
