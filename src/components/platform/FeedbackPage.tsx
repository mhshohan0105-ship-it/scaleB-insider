"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Card, Flex, Form, Input, Modal, Radio, Select, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { formatDateTime } from "@/lib/format";
import type { ListParams } from "@/lib/listParams";
import type { FeedbackList } from "@/server/services/feedback/feedbackService";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { applyActionResult } from "@/components/formResult";
import { useUrlParams } from "@/components/useUrlParams";
import { replyFeedbackAction, sendFeedbackAction } from "@/app/(app)/platform/actions";

type Row = FeedbackList["rows"][number];

const KIND: Record<string, { color: string; label: string }> = {
  BUG: { color: "red", label: "Problem" },
  IDEA: { color: "blue", label: "Idea" },
  QUESTION: { color: "purple", label: "Question" },
  OTHER: { color: "default", label: "Other" },
};

interface Props {
  data: FeedbackList;
  params: ListParams;
  feedbackStatus?: string;
  canSend: boolean;
  /** Configuration editors see everyone's feedback and reply. */
  manage: boolean;
}

export function FeedbackPage({ data, params, feedbackStatus, canSend, manage }: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const { setParams } = useUrlParams();
  const [form] = Form.useForm<{ kind: string; message: string }>();
  const [replyForm] = Form.useForm<{ reply?: string; status: string }>();
  const [sending, setSending] = useState(false);
  const [replying, setReplying] = useState<Row | null>(null);

  async function send() {
    const v = await form.validateFields();
    setSending(true);
    const r = await sendFeedbackAction(v);
    setSending(false);
    if (applyActionResult(r, form, message, "Thank you, your feedback was sent")) {
      form.resetFields();
      router.refresh();
    }
  }

  async function saveReply() {
    const v = await replyForm.validateFields();
    const r = await replyFeedbackAction(replying!.id, v);
    if (applyActionResult(r, replyForm, message, "Saved")) {
      setReplying(null);
      router.refresh();
    }
  }

  const columns: TableColumnsType<Row> = [
    { title: "Sent", dataIndex: "at", key: "at", width: 170, render: (v) => formatDateTime(v) },
    ...(manage ? [{ title: "From", dataIndex: "from", key: "from" }] : []),
    {
      title: "Type",
      dataIndex: "kind",
      key: "k",
      render: (v: string) => <Tag color={KIND[v]?.color}>{KIND[v]?.label}</Tag>,
    },
    {
      title: "Feedback",
      key: "m",
      render: (_, r) => (
        <div style={{ maxWidth: 460, whiteSpace: "pre-wrap" }}>
          {r.message}
          {r.reply && (
            <Typography.Paragraph
              type="secondary"
              style={{ margin: "6px 0 0", borderLeft: "3px solid #0f766e", paddingLeft: 8 }}
            >
              Reply: {r.reply}
            </Typography.Paragraph>
          )}
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "s",
      render: (v: string) =>
        v === "DONE" ? <Tag color="green">Done</Tag> : <Tag color="gold">Open</Tag>,
    },
    ...(manage
      ? [
          {
            title: "",
            key: "act",
            render: (_: unknown, r: Row) => (
              <Button
                size="small"
                onClick={() => {
                  setReplying(r);
                  replyForm.setFieldsValue({ reply: r.reply ?? "", status: "DONE" });
                }}
              >
                Reply
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Feedback"
        description="Report a problem, suggest an idea or ask a question. Your agency's administrators read every message."
      />
      {canSend && (
        <Card style={{ marginBottom: 16 }}>
          <Form form={form} layout="vertical" initialValues={{ kind: "IDEA" }}>
            <Form.Item name="kind" label="What is it about?">
              <Radio.Group
                optionType="button"
                options={Object.entries(KIND).map(([value, k]) => ({ value, label: k.label }))}
              />
            </Form.Item>
            <Form.Item
              name="message"
              label="Your feedback"
              rules={[{ required: true, message: "Write your feedback" }]}
            >
              <Input.TextArea rows={3} maxLength={2000} showCount />
            </Form.Item>
            <Button type="primary" loading={sending} onClick={send}>
              Send feedback
            </Button>
          </Form>
        </Card>
      )}
      <Card title={manage ? "All feedback" : "Your feedback"}>
        <Flex gap={12} style={{ marginBottom: 12 }}>
          <Select
            style={{ width: 150 }}
            value={feedbackStatus ?? ""}
            onChange={(v) => setParams({ feedbackStatus: v })}
            aria-label="Status"
            options={[
              { value: "", label: "Any status" },
              { value: "OPEN", label: "Open" },
              { value: "DONE", label: "Done" },
            ]}
          />
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
        open={replying !== null}
        title="Reply to feedback"
        okText="Save"
        onOk={saveReply}
        onCancel={() => setReplying(null)}
        destroyOnHidden
      >
        {replying && <Typography.Paragraph>{replying.message}</Typography.Paragraph>}
        <Form form={replyForm} layout="vertical">
          <Form.Item name="reply" label="Reply">
            <Input.TextArea rows={3} maxLength={2000} />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Radio.Group
              options={[
                { value: "OPEN", label: "Still open" },
                { value: "DONE", label: "Done" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
