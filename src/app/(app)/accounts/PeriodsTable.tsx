"use client";

import { useRouter } from "next/navigation";
import { App, Button, Popconfirm, Table, Tag, Typography } from "antd";
import { LockOutlined, UnlockOutlined } from "@ant-design/icons";
import { formatDateTime } from "@/lib/format";
import type { PeriodRow } from "@/server/services/accounts/periodService";
import { applyActionResult } from "@/components/formResult";
import { setPeriodClosedAction } from "./actions";

const label = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** Close finished months so nothing can be posted into them by mistake. */
export function PeriodsTable({ periods, canEdit }: { periods: PeriodRow[]; canEdit: boolean }) {
  const router = useRouter();
  const { message } = App.useApp();
  const thisMonth = periods[0]?.month;

  async function toggle(p: PeriodRow) {
    const r = await setPeriodClosedAction(p.month, !p.isClosed);
    if (
      applyActionResult(
        r,
        null,
        message,
        p.isClosed ? `${label(p.month)} reopened` : `${label(p.month)} closed`,
      )
    ) {
      router.refresh();
    }
  }

  return (
    <>
      <Typography.Paragraph type="secondary">
        Nothing dated in a closed month can be posted or edited. Voids are dated today, so they
        still work. Reopen a month if a correction is really needed.
      </Typography.Paragraph>
      <Table<PeriodRow>
        rowKey="month"
        size="small"
        pagination={false}
        dataSource={periods}
        columns={[
          { title: "Month", dataIndex: "month", render: (m: string) => label(m) },
          { title: "Journal entries", dataIndex: "entries", align: "right" },
          {
            title: "Status",
            key: "status",
            render: (_, p) =>
              p.isClosed ? (
                <Tag
                  icon={<LockOutlined />}
                  color="default"
                  title={p.closedAt ? `Closed ${formatDateTime(p.closedAt)}` : undefined}
                >
                  Closed
                </Tag>
              ) : (
                <Tag color="green">Open</Tag>
              ),
          },
          ...(canEdit
            ? [
                {
                  key: "action",
                  align: "right" as const,
                  render: (_: unknown, p: PeriodRow) =>
                    p.month === thisMonth && !p.isClosed ? (
                      <Typography.Text type="secondary">Current month</Typography.Text>
                    ) : (
                      <Popconfirm
                        title={
                          p.isClosed ? `Reopen ${label(p.month)}?` : `Close ${label(p.month)}?`
                        }
                        onConfirm={() => toggle(p)}
                      >
                        <Button
                          size="small"
                          icon={p.isClosed ? <UnlockOutlined /> : <LockOutlined />}
                        >
                          {p.isClosed ? "Reopen" : "Close"}
                        </Button>
                      </Popconfirm>
                    ),
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
