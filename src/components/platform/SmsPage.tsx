"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, App, Button, Card, Flex, Form, Input, Modal, Statistic, Tag } from "antd";
import type { TableColumnsType } from "antd";
import { SendOutlined } from "@ant-design/icons";
import { formatDateTime } from "@/lib/format";
import type { ListParams } from "@/lib/listParams";
import { SMS_EVENT_LABEL, smsParts } from "@/lib/sms";
import type { SmsLogList } from "@/server/services/sms/smsService";
import { DataTable } from "@/components/DataTable";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { PageHeader } from "@/components/PageHeader";
import { applyActionResult } from "@/components/formResult";
import { useUrlParams } from "@/components/useUrlParams";
import { passportRemindersAction, sendSmsAction } from "@/app/(app)/platform/actions";

type Row = SmsLogList["rows"][number];

const STATUS: Record<string, { color: string; label: string }> = {
  SENT: { color: "green", label: "Sent" },
  FAILED: { color: "red", label: "Failed" },
  SIMULATED: { color: "default", label: "Simulated" },
};

interface Props {
  data: SmsLogList;
  params: ListParams;
  enabled: boolean;
  canSend: boolean;
}

export function SmsPage({ data, params, enabled, canSend }: Props) {
  const router = useRouter();
  const { message, modal } = App.useApp();
  const { setParams } = useUrlParams();
  const [search, setSearch] = useState(params.q);
  const [composing, setComposing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{ to: string; message: string }>();
  const text = Form.useWatch("message", form) ?? "";

  async function send() {
    const v = await form.validateFields();
    setSaving(true);
    const r = await sendSmsAction(v);
    setSaving(false);
    if (!applyActionResult(r, form, message)) return;
    if (r.data.status === "FAILED") message.error(`Not sent: ${r.data.error ?? "gateway error"}`);
    else message.success(r.data.status === "SIMULATED" ? "Logged (no gateway set)" : "SMS sent");
    setComposing(false);
    form.resetFields();
    router.refresh();
  }

  function reminders() {
    modal.confirm({
      title: "Send passport expiry reminders?",
      content:
        "Clients whose passport expires within 6 months get one SMS. Anyone reminded in the last 30 days is skipped. This also runs every morning by itself.",
      okText: "Send now",
      onOk: async () => {
        const r = await passportRemindersAction();
        if (applyActionResult(r, null, message))
          message.success(
            `${r.data.sent} sent, ${r.data.skipped} without a mobile number (${r.data.considered} due)`,
          );
        router.refresh();
      },
    });
  }

  const columns: TableColumnsType<Row> = [
    { title: "Time", dataIndex: "at", key: "at", width: 170, render: (v) => formatDateTime(v) },
    { title: "To", dataIndex: "to", key: "to" },
    {
      title: "Message",
      key: "m",
      render: (_, r) => (
        <div style={{ maxWidth: 420, whiteSpace: "normal" }}>
          {r.message}
          <div style={{ fontSize: 12, color: "#888" }}>
            {r.parts} part{r.parts === 1 ? "" : "s"}
          </div>
        </div>
      ),
    },
    {
      title: "Event",
      dataIndex: "event",
      key: "e",
      render: (v: string) => SMS_EVENT_LABEL[v] ?? v,
    },
    {
      title: "Status",
      key: "s",
      render: (_, r) => (
        <>
          <Tag color={STATUS[r.status]?.color}>{STATUS[r.status]?.label ?? r.status}</Tag>
          {r.error && <div style={{ fontSize: 12, color: "#c0392b" }}>{r.error}</div>}
        </>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="SMS"
        description="Messages to clients: visa updates, passport reminders and messages sent by hand."
        extra={
          canSend && (
            <>
              <Button onClick={reminders} disabled={!enabled}>
                Passport reminders
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={() => setComposing(true)}
                disabled={!enabled}
              >
                New SMS
              </Button>
            </>
          )
        }
      />
      {!enabled && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <>
              SMS is turned off for this agency. Turn it on in{" "}
              <Link href="/settings/app">App Config</Link>.
            </>
          }
        />
      )}
      {data.provider === "simulated" && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="No SMS gateway is configured on the server. Messages are logged but not delivered (see DEPLOYMENT.md, SMS_* settings)."
        />
      )}
      <Card style={{ marginBottom: 16 }}>
        <Flex gap={48} wrap>
          <Statistic title="Sent" value={data.counts.SENT ?? 0} />
          <Statistic title="Failed" value={data.counts.FAILED ?? 0} />
          <Statistic title="Logged only" value={data.counts.SIMULATED ?? 0} />
          <Statistic title="Gateway" value={data.provider} />
        </Flex>
      </Card>
      <Card>
        <Flex gap={12} wrap style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder="Number or text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(v) => setParams({ q: v })}
            style={{ width: 260 }}
          />
          <DateRangeFilter from={params.from} to={params.to} />
        </Flex>
        <DataTable<Row>
          rows={data.rows}
          total={data.total}
          page={params.page}
          pageSize={params.pageSize}
          columns={columns}
        />
      </Card>
      <Modal
        open={composing}
        title="New SMS"
        okText="Send"
        okButtonProps={{ loading: saving }}
        onOk={send}
        onCancel={() => setComposing(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Mobile number"
            name="to"
            rules={[{ required: true, message: "Enter the mobile number" }]}
          >
            <Input placeholder="01XXXXXXXXX" maxLength={20} />
          </Form.Item>
          <Form.Item
            label="Message"
            name="message"
            rules={[{ required: true, message: "Write the message" }]}
            extra={`${text.length} characters · ${smsParts(text)} part(s)`}
          >
            <Input.TextArea rows={4} maxLength={640} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
