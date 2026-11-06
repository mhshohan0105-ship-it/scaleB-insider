import { AccessDenied } from "@/components/ModulePlaceholder";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { getDashboard, redactDashboard } from "@/server/services/dashboard/dashboardService";
import { DashboardView } from "./DashboardView";

export default async function DashboardPage() {
  const user = await getUserContext();
  if (!can(user.permissions, "dashboard", "view")) return <AccessDenied />;
  const canSeeAccounts = can(user.permissions, "accounts", "view");
  const canSeeClients = can(user.permissions, "clients", "view");
  const data = redactDashboard(
    await getDashboard(await toServiceContext(user), {
      checkLedger: can(user.permissions, "accounts", "edit"),
    }),
    {
      accounts: canSeeAccounts,
      expense: can(user.permissions, "expense", "view"),
      clients: canSeeClients,
    },
  );
  const actions = [
    can(user.permissions, "invoice_air", "create") && {
      label: "Air ticket invoice",
      href: "/invoices/airticket/new",
    },
    can(user.permissions, "invoice_visa", "create") && {
      label: "Visa invoice",
      href: "/invoices/visa/new",
    },
    can(user.permissions, "money_receipt", "create") && {
      label: "Money receipt",
      href: "/moneyreceipts/new",
    },
    can(user.permissions, "expense", "create") && { label: "Expense", href: "/expenses/new" },
  ].filter((a): a is { label: string; href: string } => !!a);
  return (
    <DashboardView
      data={data}
      userName={user.name}
      actions={actions}
      canSeeAccounts={canSeeAccounts}
      canSeeClients={canSeeClients}
      canSeeExpenses={can(user.permissions, "expense", "view")}
      canSeeReports={can(user.permissions, "reports", "view")}
      canReceive={can(user.permissions, "money_receipt", "create")}
    />
  );
}
