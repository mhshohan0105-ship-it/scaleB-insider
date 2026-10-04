import { AccessDenied } from "@/components/ModulePlaceholder";
import { AdminPage } from "@/components/platform/AdminPage";
import { getUserContext } from "@/server/auth/session";
import { PLANS, listAgencies } from "@/server/services/admin/adminService";

export default async function AdminRoute() {
  const user = await getUserContext();
  if (!user.isSuperAdmin) return <AccessDenied />;
  const agencies = await listAgencies({
    userId: user.userId,
    agencyId: user.agencyId,
    name: user.name,
  });
  return <AdminPage agencies={agencies} plans={PLANS.map((p) => ({ ...p }))} />;
}
