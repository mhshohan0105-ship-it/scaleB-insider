import { AccessDenied } from "@/components/ModulePlaceholder";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { getAppConfig } from "@/server/services/settings/settingsService";
import { AppConfigForm } from "./AppConfigForm";

export default async function AppConfigPage() {
  const user = await getUserContext();
  if (!can(user.permissions, "configuration", "view")) return <AccessDenied />;
  const config = await getAppConfig(await toServiceContext(user));
  return (
    <AppConfigForm initial={config} canEdit={can(user.permissions, "configuration", "edit")} />
  );
}
