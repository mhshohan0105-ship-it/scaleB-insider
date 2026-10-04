"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Card, Divider, Form, Input, Modal, Select, Space, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { formatDate, formatDateTime } from "@/lib/format";
import type { AgencyRow } from "@/server/services/admin/adminService";
import { PageHeader } from "@/components/PageHeader";
import { applyActionResult } from "@/components/formResult";
import {
  createAgencyAction,
  openAgencyAction,
  setAgencyPlanAction,
  setAgencyStatusAction,
} from "@/app/(app)/platform/actions";

interface Props {
  agencies: AgencyRow[];
  plans: { value: string; label: string }[];
}

interface NewAgency {
  code: string;
  name: string;
  phone?: string;
  email?: string;
  owner: { name: string; username: string; password: string };
}

export function AdminPage({ agencies, plans }: Props) {
  const router = useRouter();
  const { message, modal } = App.useApp();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<NewAgency>();

  async function create() {
    const v = await form.validateFields();
    setSaving(true);
    const r = await createAgencyAction({
      ...v,
      phone: v.phone || undefined,
      email: v.email || undefined,
    });
    setSaving(false);
    if (applyActionResult(r, form, message, `Agency ${r.ok ? r.data.code : ""} created`)) {
      setCreating(false);
      form.resetFields();
      router.refresh();
    }
  }

  function toggle(a: AgencyRow) {
    const suspend = a.status === "ACTIVE";
    modal.confirm({
      title: `${suspend ? "Suspend" : "Activate"} ${a.name}?`,
      content: suspend
        ? "Nobody in this agency can sign in until it is activated again. Data is kept."
        : "Users of this agency can sign in again.",
      okText: suspend ? "Suspend" : "Activate",
      okButtonProps: { danger: suspend },
      onOk: async () => {
        const r = await setAgencyStatusAction(a.id, suspend ? "SUSPENDED" : "ACTIVE");
        if (applyActionResult(r, null, message, "Saved")) router.refresh();
      },
    });
  }

  function open(a: AgencyRow) {
    modal.confirm({
      title: `Open ${a.name} as its owner?`,
      content:
        "You will be signed out of your own account and into this agency. Everything you do there is recorded in its audit log under your name. Sign out to end.",
      okText: "Open",
      onOk: async () => {
        const r = await openAgencyAction(a.id);
        // On success the action redirects; only failures come back here.
        if (!r.ok) message.error(r.error);
      },
    });
  }

  const columns: TableColumnsType<AgencyRow> = [
    {
      title: "Agency",
      key: "n",
      render: (_, a) => (
        <>
          {a.name} {a.isOwn && <Tag>yours</Tag>}
          <div style={{ fontSize: 12, color: "#888" }}>
            {a.code}
            {a.phone && ` · ${a.phone}`}
          </div>
        </>
      ),
    },
    {
      title: "Plan",
      key: "p",
      render: (_, a) => (
        <Select
          size="small"
          style={{ width: 120 }}
          value={a.plan}
          options={plans}
          aria-label={`Plan for ${a.code}`}
          onChange={async (v) => {
            const r = await setAgencyPlanAction(a.id, v);
            if (applyActionResult(r, null, message, "Plan changed")) router.refresh();
          }}
        />
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "s",
      render: (v: string) =>
        v === "ACTIVE" ? <Tag color="green">Active</Tag> : <Tag color="red">Suspended</Tag>,
    },
    { title: "Users", dataIndex: "users", key: "u", align: "right" },
    { title: "Clients", dataIndex: "clients", key: "c", align: "right" },
    { title: "Invoices", dataIndex: "invoices", key: "i", align: "right" },
    { title: "Since", dataIndex: "createdAt", key: "since", render: (v) => formatDate(v) },
    {
      title: "Last sign in",
      dataIndex: "lastLoginAt",
      key: "ll",
      render: (v: string | null) => (v ? formatDateTime(v) : "-"),
    },
    {
      title: "",
      key: "act",
      render: (_, a) => (
        <Space size={4}>
          {!a.isOwn && a.status === "ACTIVE" && (
            <Button size="small" onClick={() => open(a)}>
              Open as owner
            </Button>
          )}
          {!a.isOwn && (
            <Button size="small" danger={a.status === "ACTIVE"} onClick={() => toggle(a)}>
              {a.status === "ACTIVE" ? "Suspend" : "Activate"}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Platform admin"
        description="Every agency on this installation. Only platform administrators see this page."
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
            New agency
          </Button>
        }
      />
      <Card>
        <Table<AgencyRow>
          rowKey="id"
          size="middle"
          dataSource={agencies}
          columns={columns}
          pagination={false}
          scroll={{ x: "max-content" }}
        />
      </Card>
      <Modal
        open={creating}
        title="New agency"
        okText="Create"
        okButtonProps={{ loading: saving }}
        onOk={create}
        onCancel={() => setCreating(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="Agency code (used to sign in)"
            rules={[
              { required: true, message: "Required" },
              {
                pattern: /^[a-z0-9][a-z0-9-]{1,38}$/,
                message: "2 to 39 lowercase letters, digits or dashes",
              },
            ]}
          >
            <Input placeholder="e.g. skyline" />
          </Form.Item>
          <Form.Item name="name" label="Agency name" rules={[{ required: true, min: 2 }]}>
            <Input />
          </Form.Item>
          <Space.Compact block>
            <Form.Item name="phone" label="Phone" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email" style={{ flex: 1 }} rules={[{ type: "email" }]}>
              <Input />
            </Form.Item>
          </Space.Compact>
          <Divider plain>Owner account</Divider>
          <Form.Item
            name={["owner", "name"]}
            label="Owner name"
            rules={[{ required: true, min: 2 }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name={["owner", "username"]}
            label="Username"
            rules={[
              { required: true, message: "Required" },
              { pattern: /^[a-z0-9._-]{3,60}$/, message: "3+ lowercase letters, digits, . _ -" },
            ]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name={["owner", "password"]}
            label="First password"
            rules={[{ required: true, min: 8, message: "At least 8 characters" }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
