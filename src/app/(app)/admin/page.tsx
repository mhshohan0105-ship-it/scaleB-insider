import { AccessDenied } from "@/components/ModulePlaceholder";
import { AdminPage } from "@/components/platform/AdminPage";
import { getUserContext } from "@/server/auth/session";
import { listAgencies, listPlans } from "@/server/services/admin/adminService";

export default async function AdminRoute() {
  const user = await getUserContext();
  if (!user.isSuperAdmin) return <AccessDenied />;
  const actor = { userId: user.userId, agencyId: user.agencyId, name: user.name };
  const [agencies, plans] = await Promise.all([listAgencies(actor), listPlans(actor)]);
  return <AdminPage agencies={agencies} plans={plans} />;
}
