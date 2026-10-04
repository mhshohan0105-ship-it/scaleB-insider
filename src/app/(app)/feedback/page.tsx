import { AccessDenied } from "@/components/ModulePlaceholder";
import { FeedbackPage } from "@/components/platform/FeedbackPage";
import { firstParam, parseListParams } from "@/lib/listParams";
import { can } from "@/lib/permissions";
import { getUserContext, toServiceContext } from "@/server/auth/session";
import { listFeedback } from "@/server/services/feedback/feedbackService";
import type { RawSearchParams } from "../loadEntityPage";

export default async function FeedbackRoute({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await getUserContext();
  if (!can(user.permissions, "feedback", "view")) return <AccessDenied />;
  const raw = await searchParams;
  const params = parseListParams(raw);
  const s = firstParam(raw.feedbackStatus);
  const feedbackStatus = s === "OPEN" || s === "DONE" ? s : undefined;
  const manage = can(user.permissions, "configuration", "edit");
  const data = await listFeedback(
    await toServiceContext(user),
    { ...params, feedbackStatus },
    !manage,
  );
  return (
    <FeedbackPage
      data={data}
      params={params}
      feedbackStatus={feedbackStatus}
      canSend={can(user.permissions, "feedback", "create")}
      manage={manage}
    />
  );
}
