"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Empty, Flex, List, Popover, Typography } from "antd";
import { BellOutlined } from "@ant-design/icons";
import type { MyNotifications } from "@/server/services/notifications/notificationService";
import { markReadAction, notificationsAction } from "@/app/(app)/shell/actions";

const POLL_MS = 60_000;

function ago(iso: string) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

/** Header bell: unread count, the latest notifications, mark as read. */
export function NotificationBell() {
  const router = useRouter();
  const [data, setData] = useState<MyNotifications | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const r = await notificationsAction();
    if (r.ok) setData(r.data);
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  async function openItem(id: string, link: string | null) {
    await markReadAction(id);
    setOpen(false);
    void load();
    if (link) router.push(link);
  }

  const content = (
    <div style={{ width: 340 }}>
      <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
        <Typography.Text strong>Notifications</Typography.Text>
        {!!data?.unread && (
          <Button
            type="link"
            size="small"
            onClick={async () => {
              await markReadAction();
              void load();
            }}
          >
            Mark all read
          </Button>
        )}
      </Flex>
      {!data?.rows.length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing yet" />
      ) : (
        <List
          size="small"
          dataSource={data.rows}
          style={{ maxHeight: 380, overflowY: "auto" }}
          renderItem={(n) => (
            <List.Item
              style={{
                cursor: "pointer",
                background: n.read ? undefined : "#f0faf8",
                paddingInline: 8,
              }}
              onClick={() => void openItem(n.id, n.link)}
            >
              <List.Item.Meta
                title={<span style={{ fontWeight: n.read ? 400 : 600 }}>{n.title}</span>}
                description={
                  <>
                    {n.body && <div>{n.body}</div>}
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {ago(n.at)}
                    </Typography.Text>
                  </>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void load();
      }}
    >
      <Badge count={data?.unread ?? 0} size="small">
        <Button type="text" shape="circle" aria-label="Notifications" icon={<BellOutlined />} />
      </Badge>
    </Popover>
  );
}
