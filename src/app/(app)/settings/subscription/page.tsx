import { AccessDenied } from "@/components/ModulePlaceholder";
import { SubscriptionView } from "@/components/subscription/SubscriptionView";
import { can } from "@/lib/permissions";
import { getUserContext } from "@/server/auth/session";
import { subscriptionPage } from "@/server/services/subscription/subscriptionService";

export default async function SubscriptionPage() {
  const user = await getUserContext();
  if (!can(user.permissions, "configuration", "view")) return <AccessDenied />;
  return <SubscriptionView data={await subscriptionPage(user.agencyId)} />;
}
