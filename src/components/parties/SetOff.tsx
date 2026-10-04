"use client";

// Combined client set-off: settles what they owe us (client account) against
// what we owe them (vendor account).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, App, Button, DatePicker, Descriptions, Form, Input, Modal, Space, Tag } from "antd";
import type { TableColumnsType } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { formatDate, formatMoney } from "@/lib/format";
import { invoiceHref } from "@/lib/invoiceTypes";
import type { ListParams } from "@/lib/listParams";
import type { SetOffList, SetOffRow } from "@/server/services/parties/combinedService";
import { DataTable } from "@/components/DataTable";
import { MoneyInput } from "@/components/MoneyInput";
import { DocumentStatusTag } from "@/components/StatusTag";
import { VoidButton } from "@/components/VoidButton";
import { applyActionResult } from "@/components/formResult";
import {
  setOffAction,
  setOffLimitAction,
  voidSetOffAction,
} from "@/app/(app)/clients/combined/actions";

interface Limit {
  receivable: string;
  payable: string;
  max: string;
}

export function SetOffButton({ combinedId, today }: { combinedId: string; today: string }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [limit, setLimit] = useState<Limit | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{ date: Dayjs; amount: string; note?: string }>();

  async function open() {
    const r = await setOffLimitAction(combinedId);
    if (!applyActionResult(r, null, message)) return;
    setLimit(r.data);
  }

  async function save() {
    const v = await form.validateFields();
    setSaving(true);
    const r = await setOffAction(combinedId, { ...v, date: v.date.format("YYYY-MM-DD") });
    setSaving(false);
    if (applyActionResult(r, form, message, r.ok ? `Set-off ${r.data.number} saved` : undefined)) {
      setLimit(null);
      router.refresh();
    }
  }

  const nothing = limit !== null && limit.max === "0.00";
  return (
    <>
      <Button onClick={open}>Set off</Button>
      <Modal
        open={limit !== null}
        title="Set off receivable against payable"
        okText="Save set-off"
        okButtonProps={{ loading: saving, disabled: nothing }}
        onOk={save}
        onCancel={() => setLimit(null)}
        destroyOnHidden
      >
        {limit && (
          <>
            <Descriptions
              size="small"
              column={1}
              bordered
              style={{ marginBottom: 16 }}
              items={[
                {
                  key: "r",
                  label: "They owe us (client account)",
                  children: formatMoney(limit.receivable),
                },
                {
                  key: "p",
                  label: "We owe them (vendor account)",
                  children: formatMoney(limit.payable),
                },
                {
                  key: "m",
                  label: "Can be set off",
                  children: <strong>{formatMoney(limit.max)}</strong>,
                },
              ]}
            />
            {nothing ? (
              <Alert
                type="info"
                showIcon
                message="Nothing to set off: they must owe us and we must owe them at the same time."
              />
            ) : (
              <Form
                form={form}
                layout="vertical"
                preserve={false}
                initialValues={{ date: dayjs(today), amount: limit.max }}
              >
                <Form.Item
                  label="Date"
                  name="date"
                  rules={[{ required: true, message: "Required" }]}
                >
                  <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
                </Form.Item>
                <Form.Item
                  label="Amount"
                  name="amount"
                  rules={[{ required: true, message: "Enter the amount" }]}
                  extra="Lowers both sides by this amount and settles their oldest open invoices."
                >
                  <MoneyInput style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item label="Note" name="note">
                  <Input.TextArea rows={2} maxLength={500} />
                </Form.Item>
              </Form>
            )}
          </>
        )}
      </Modal>
    </>
  );
}

export function SetOffPanel({
  data,
  params,
  canVoid,
}: {
  data: SetOffList;
  params: ListParams;
  canVoid: boolean;
}) {
  const columns: TableColumnsType<SetOffRow> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "d",
      width: 115,
      render: (v: string) => formatDate(v),
    },
    { title: "Number", dataIndex: "number", key: "n" },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "a",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
    {
      title: "Invoices settled",
      key: "inv",
      render: (_, r) =>
        r.invoices.length ? (
          <Space size={4} wrap>
            {r.invoices.map((i) => (
              <Link key={i.id} href={invoiceHref(i.type, i.id) ?? "#"}>
                <Tag>
                  {i.number}: {formatMoney(i.amount)}
                </Tag>
              </Link>
            ))}
          </Space>
        ) : (
          "-"
        ),
    },
    { title: "Note", dataIndex: "note", key: "note", render: (v: string | null) => v ?? "" },
    {
      title: "Status",
      key: "s",
      render: (_, r) => (
        <>
          <DocumentStatusTag status={r.status} />
          {r.voidReason && <div style={{ fontSize: 12, color: "#888" }}>{r.voidReason}</div>}
        </>
      ),
    },
    ...(canVoid
      ? [
          {
            title: "",
            key: "act",
            render: (_: unknown, r: SetOffRow) =>
              r.status === "POSTED" && (
                <VoidButton
                  what={`set-off ${r.number}`}
                  description="Its entry is reversed and the invoices it settled are due again."
                  buttonProps={{ size: "small" }}
                  onVoid={(v) => voidSetOffAction(r.id, v)}
                />
              ),
          },
        ]
      : []),
  ];
  return (
    <DataTable<SetOffRow>
      rows={data.rows}
      total={data.total}
      page={params.page}
      pageSize={params.pageSize}
      columns={columns}
    />
  );
}
