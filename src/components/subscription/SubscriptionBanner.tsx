"use client";

import Link from "next/link";
import { Alert } from "antd";
import { formatDate } from "@/lib/format";
import type { SubscriptionStatus } from "@/lib/subscription";

const days = (n: number) => (n === 1 ? "1 day" : `${n} days`);

/** Strip above every page while a trial runs or a paid period is ending or over. */
export function SubscriptionBanner({
  status,
  canManage,
}: {
  status: SubscriptionStatus;
  /** Users who can open Settings get a link to the Subscription page. */
  canManage: boolean;
}) {
  if (status.state === "ok" || !status.endsAt || status.daysLeft === null) return null;
  const end = formatDate(status.endsAt);
  const left = Math.max(status.daysLeft, 0);

  let type: "info" | "warning" | "error";
  let text: string;
  if (status.state === "expired") {
    type = "error";
    text = status.trial
      ? `Your free trial ended on ${end}. You can still view and export everything; adding or changing records is paused until you choose a plan.`
      : `Your subscription has ended. You can still view and export everything; adding or changing records is paused until it is renewed.`;
  } else if (status.state === "grace") {
    type = "warning";
    text = `Your subscription is due. Records can be added for ${days(left)} more (until ${end}); after that the account becomes view only.`;
  } else if (status.trial) {
    type = "info";
    text = `Free trial: ${left ? `${days(left)} left` : "last day"} (until ${end}).`;
  } else {
    type = "info";
    text = `Your subscription is due for renewal. Renew before ${end} to avoid any pause.`;
  }

  return (
    <Alert
      type={type}
      showIcon
      banner
      style={{ marginBottom: 16, borderRadius: 8 }}
      message={text}
      action={
        canManage ? (
          <Link href="/settings/subscription" style={{ whiteSpace: "nowrap" }}>
            See plan
          </Link>
        ) : undefined
      }
    />
  );
}
