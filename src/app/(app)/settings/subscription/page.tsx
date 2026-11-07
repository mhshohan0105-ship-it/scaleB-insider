import { AccessDenied } from "@/components/ModulePlaceholder";
import { SubscriptionView } from "@/components/subscription/SubscriptionView";
import { can } from "@/lib/permissions";
import { getUserContext } from "@/server/auth/session";
import { mySubscriptionPayments } from "@/server/services/subscription/paymentService";
import { subscriptionPage } from "@/server/services/subscription/subscriptionService";

export default async function SubscriptionPage() {
  const user = await getUserContext();
  if (!can(user.permissions, "configuration", "view")) return <AccessDenied />;
  const [data, payments] = await Promise.all([
    subscriptionPage(user.agencyId),
    mySubscriptionPayments(user.agencyId),
  ]);
  return <SubscriptionView data={data} payments={payments} />;
}
