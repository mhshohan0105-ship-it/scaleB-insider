import { AccessDenied } from "@/components/ModulePlaceholder";
import { SmsPage } from "@/components/platform/SmsPage";
import { parseListParams } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { getAppConfig } from "@/server/services/settings/settingsService";
import { listSmsLogs } from "@/server/services/sms/smsService";
import type { RawSearchParams } from "../../loadEntityPage";

export default async function SmsRoute({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await getUserContext();
  if (!can(user.permissions, "configuration", "view")) return <AccessDenied />;
  const ctx = await toServiceContext(user);
  const params = parseListParams(await searchParams);
  const [data, config] = await Promise.all([listSmsLogs(ctx, params), getAppConfig(ctx)]);
  return (
    <SmsPage
      data={data}
      params={params}
      enabled={config.smsEnabled}
      canSend={can(user.permissions, "configuration", "create")}
    />
  );
}
