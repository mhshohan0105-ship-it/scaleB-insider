import { AccessDenied } from "@/components/ModulePlaceholder";
import { ReportDirectory } from "@/components/reports/ReportDirectory";
import { can } from "@/lib/permissions";
import { reportDirectory } from "@/lib/reports/directory";
import { getUserContext } from "@/server/auth/session";

export default async function ReportsHomePage() {
  const user = await getUserContext();
  if (!can(user.permissions, "reports", "view")) return <AccessDenied />;
  return <ReportDirectory sections={reportDirectory(user.permissions)} />;
}
