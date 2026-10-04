import { AccessDenied } from "@/components/ModulePlaceholder";
import { parseListParams } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { listUsers, userFormOptions } from "@/server/services/users/userService";
import type { RawSearchParams } from "../../loadEntityPage";
import { UsersPage } from "./UsersPage";

export default async function UsersListPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await getUserContext();
  if (!can(user.permissions, "configuration", "view")) return <AccessDenied />;
  const ctx = await toServiceContext(user);
  const params = parseListParams(await searchParams);
  const [list, options] = await Promise.all([listUsers(ctx, params), userFormOptions(ctx)]);
  return (
    <UsersPage
      {...list}
      params={params}
      options={options}
      currentUserId={user.userId}
      canCreate={can(user.permissions, "configuration", "create")}
      canEdit={can(user.permissions, "configuration", "edit")}
    />
  );
}
