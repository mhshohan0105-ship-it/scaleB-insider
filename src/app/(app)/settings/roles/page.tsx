import { AccessDenied } from "@/components/ModulePlaceholder";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { listRoles } from "@/server/services/roles/roleService";
import { RolesPage } from "./RolesPage";

export default async function RolesListPage() {
  const user = await getUserContext();
  if (!can(user.permissions, "configuration", "view")) return <AccessDenied />;
  const roles = await listRoles(await toServiceContext(user));
  return (
    <RolesPage
      roles={roles}
      canCreate={can(user.permissions, "configuration", "create")}
      canEdit={can(user.permissions, "configuration", "edit")}
    />
  );
}
