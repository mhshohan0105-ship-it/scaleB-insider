import { AccessDenied } from "@/components/ModulePlaceholder";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { getProfile } from "@/server/services/settings/settingsService";
import { ProfileForm } from "./ProfileForm";

export default async function AgencyProfilePage() {
  const user = await getUserContext();
  if (!can(user.permissions, "configuration", "view")) return <AccessDenied />;
  const profile = await getProfile(await toServiceContext(user));
  return <ProfileForm initial={profile} canEdit={can(user.permissions, "configuration", "edit")} />;
}
