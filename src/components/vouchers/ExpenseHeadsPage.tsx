"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Card, Form, Input, Modal, Space, Table, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { applyActionResult } from "@/components/formResult";
import { saveExpenseHeadAction, setExpenseHeadActiveAction } from "@/app/(app)/vouchers/actions";

interface Head {
  id: string;
  name: string;
  note: string | null;
  isActive: boolean;
  spent: string;
  count: number;
}

export function ExpenseHeadsPage({
  heads,
  canCreate,
  canEdit,
  fiscalYearLabel,
}: {
  heads: Head[];
  canCreate: boolean;
  canEdit: boolean;
  fiscalYearLabel: string;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<{ name: string; note?: string }>();
  const [editing, setEditing] = useState<Head | "new" | null>(null);
  const [saving, setSaving] = useState(false);

  function open(h: Head | "new") {
    setEditing(h);
    form.setFieldsValue(
      h === "new" ? { name: "", note: "" } : { name: h.name, note: h.note ?? "" },
    );
  }

  async function save() {
    const v = await form.validateFields();
    setSaving(true);
    const result = await saveExpenseHeadAction(editing === "new" ? null : editing!.id, v);
    setSaving(false);
    if (applyActionResult(result, form, message, "Expense head saved")) {
      setEditing(null);
      router.refresh();
    }
  }

  async function toggle(h: Head) {
    const r = await setExpenseHeadActiveAction(h.id, !h.isActive);
    if (applyActionResult(r, null, message, h.isActive ? "Deactivated" : "Activated"))
      router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Expense Heads"
        description="Each head has its own line in the Profit & Loss."
        extra={
          canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => open("new")}>
              Add head
            </Button>
          )
        }
      />
      <Card>
        <Table<Head>
          rowKey="id"
          dataSource={heads}
          pagination={false}
          columns={[
            {
              title: "Head",
              key: "name",
              render: (_, h) => (
                <>
                  {h.name} {!h.isActive && <Tag>Inactive</Tag>}
                  {h.note && <div style={{ fontSize: 12, color: "#888" }}>{h.note}</div>}
                </>
              ),
            },
            {
              title: `Entries (${fiscalYearLabel})`,
              dataIndex: "count",
              key: "count",
              align: "right",
            },
            {
              title: `Spent (${fiscalYearLabel})`,
              dataIndex: "spent",
              key: "spent",
              align: "right",
              render: (v: string) => formatMoney(v),
            },
            ...(canEdit
              ? [
                  {
                    title: "",
                    key: "act",
                    render: (_: unknown, h: Head) => (
                      <Space>
                        <Button size="small" onClick={() => open(h)}>
                          Edit
                        </Button>
                        <Button size="small" onClick={() => toggle(h)}>
                          {h.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </Space>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>
      <Modal
        open={editing !== null}
        title={editing === "new" ? "Add expense head" : "Edit expense head"}
        okText="Save"
        okButtonProps={{ loading: saving }}
        onOk={save}
        onCancel={() => setEditing(null)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, min: 2, message: "Name the head" }]}
          >
            <Input maxLength={80} autoFocus />
          </Form.Item>
          <Form.Item label="Note" name="note">
            <Input maxLength={300} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
