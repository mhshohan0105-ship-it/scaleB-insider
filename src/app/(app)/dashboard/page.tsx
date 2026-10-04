import { AccessDenied } from "@/components/ModulePlaceholder";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { getDashboard } from "@/server/services/dashboard/dashboardService";
import { DashboardView } from "./DashboardView";

export default async function DashboardPage() {
  const user = await getUserContext();
  if (!can(user.permissions, "dashboard", "view")) return <AccessDenied />;
  const data = await getDashboard(await toServiceContext(user), {
    checkLedger: can(user.permissions, "accounts", "edit"),
  });
  return (
    <DashboardView
      data={data}
      userName={user.name}
      canSeeAccounts={can(user.permissions, "accounts", "view")}
      canSeeReports={can(user.permissions, "reports", "view")}
    />
  );
}
