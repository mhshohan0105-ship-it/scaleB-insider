import { AccessDenied } from "@/components/ModulePlaceholder";
import { SettingsHub } from "@/components/settings/SettingsHub";
import { can } from "@/lib/permissions";
import { HUB_COUNT_KEYS, SETTINGS_HUB } from "@/lib/settingsHub";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { masterCounts } from "@/server/services/masters/masterService";

export default async function SettingsHomePage() {
  const user = await getUserContext();
  if (!can(user.permissions, "configuration", "view")) return <AccessDenied />;
  const counts = await masterCounts(await toServiceContext(user), HUB_COUNT_KEYS);
  return <SettingsHub sections={SETTINGS_HUB} counts={counts} />;
}
