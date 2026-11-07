"use client";

import { useCallback, useEffect, useState } from "react";
import {
  App,
  Button,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Table,
  Tag,
} from "antd";
import type { TableColumnsType } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { formatDate, formatMoney } from "@/lib/format";
import { SUBSCRIPTION_METHOD_OPTIONS } from "@/lib/schemas/subscriptionPayment";
import type { AgencyRow, PlanRow } from "@/server/services/admin/adminService";
import type { SubscriptionPaymentRow } from "@/server/services/subscription/paymentService";
import { MoneyInput } from "@/components/MoneyInput";
import { applyActionResult } from "@/components/formResult";
import {
  agencyPaymentsAction,
  recordSubscriptionPaymentAction,
  voidSubscriptionPaymentAction,
} from "@/app/(app)/platform/actions";

interface PaymentForm {
  date: Dayjs;
  plan: string;
  months: number;
  amount: string;
  method: string;
  reference?: string;
  note?: string;
}

const METHOD = Object.fromEntries(SUBSCRIPTION_METHOD_OPTIONS.map((o) => [o.value, o.label]));

/** An agency's subscription payments: record one (renews the plan) or void one. */
export function AgencyPaymentsModal({
  agency,
  plans,
  onClose,
  onChanged,
}: {
  agency: AgencyRow;
  plans: PlanRow[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<PaymentForm>();
  const [rows, setRows] = useState<SubscriptionPaymentRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const planCode = Form.useWatch("plan", form);
  const months = Form.useWatch("months", form);

  const load = useCallback(async () => {
    const r = await agencyPaymentsAction(agency.id);
    setRows(r.ok ? r.data : []);
  }, [agency.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Suggest the plan's price for 1 or 12 months; the admin can change it.
  useEffect(() => {
    const p = plans.find((x) => x.code === planCode);
    if (!p) return;
    const set = (v: string) => /[1-9]/.test(v) && form.setFieldValue("amount", v);
    if (months === 12) set(p.priceYearly);
    else if (months === 1) set(p.priceMonthly);
  }, [planCode, months, plans, form]);

  async function record() {
    const v = await form.validateFields().catch(() => null);
    if (!v) return;
    setSaving(true);
    const r = await recordSubscriptionPaymentAction(agency.id, {
      ...v,
      date: v.date.format("YYYY-MM-DD"),
    });
    setSaving(false);
    if (applyActionResult(r, form, message, r.ok ? `${r.data.number} recorded` : undefined)) {
      form.resetFields(["amount", "reference", "note"]);
      await load();
      onChanged();
    }
  }

  function voidPayment(p: SubscriptionPaymentRow) {
    let reason = "";
    modal.confirm({
      title: `Void ${p.number}?`,
      content: (
        <Input.TextArea
          rows={2}
          placeholder="Reason"
          onChange={(e) => {
            reason = e.target.value;
          }}
        />
      ),
      okText: "Void",
      okButtonProps: { danger: true },
      onOk: async () => {
        const r = await voidSubscriptionPaymentAction(p.id, { reason });
        if (!applyActionResult(r, null, message, "Payment voided")) throw new Error("not voided");
        await load();
        onChanged();
      },
    });
  }

  const columns: TableColumnsType<SubscriptionPaymentRow> = [
    {
      title: "Receipt",
      dataIndex: "number",
      key: "n",
      render: (v: string, p) => (
        <>
          <a href={`/api/pdf/subscription/${p.id}`} target="_blank" rel="noreferrer">
            {v}
          </a>{" "}
          {p.status === "VOID" && <Tag color="red">Void</Tag>}
        </>
      ),
    },
    { title: "Date", dataIndex: "date", key: "d", render: (v: string) => formatDate(v) },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "a",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
    {
      title: "Paid by",
      key: "m",
      render: (_, p) => `${METHOD[p.method] ?? p.method}${p.reference ? ` · ${p.reference}` : ""}`,
    },
    {
      title: "Covers",
      key: "c",
      render: (_, p) => `${formatDate(p.periodFrom)} to ${formatDate(p.periodTo)}`,
    },
    {
      key: "x",
      render: (_, p) =>
        p.status === "POSTED" && (
          <Button size="small" danger onClick={() => voidPayment(p)}>
            Void
          </Button>
        ),
    },
  ];

  return (
    <Modal
      open
      title={`Payments · ${agency.name}`}
      width={860}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <Table<SubscriptionPaymentRow>
        rowKey="id"
        size="small"
        loading={rows === null}
        dataSource={rows ?? []}
        columns={columns}
        pagination={false}
        scroll={{ x: "max-content" }}
        locale={{ emptyText: "No payments yet" }}
      />
      <Divider plain>Record a payment</Divider>
      <Form<PaymentForm>
        form={form}
        name="subPayment"
        layout="vertical"
        requiredMark="optional"
        initialValues={{
          date: dayjs(),
          plan: agency.plan,
          months: 1,
          method: "MOBILE",
        }}
      >
        <Row gutter={12}>
          <Col xs={12} md={6}>
            <Form.Item label="Date" name="date" rules={[{ required: true }]}>
              <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="Plan" name="plan" rules={[{ required: true }]}>
              <Select
                options={plans
                  .filter((p) => p.isActive)
                  .map((p) => ({ value: p.code, label: p.name }))}
              />
            </Form.Item>
          </Col>
          <Col xs={12} md={4}>
            <Form.Item label="Months" name="months" rules={[{ required: true }]}>
              <InputNumber min={1} max={36} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={12} md={8}>
            <Form.Item label="Amount (BDT)" name="amount" rules={[{ required: true }]}>
              <MoneyInput />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="Paid by" name="method" rules={[{ required: true }]}>
              <Select options={[...SUBSCRIPTION_METHOD_OPTIONS]} />
            </Form.Item>
          </Col>
          <Col xs={12} md={8}>
            <Form.Item label="Reference" name="reference">
              <Input maxLength={80} placeholder="Transaction ID" />
            </Form.Item>
          </Col>
          <Col xs={24} md={10}>
            <Form.Item label="Note" name="note">
              <Input maxLength={500} />
            </Form.Item>
          </Col>
        </Row>
        <Button type="primary" onClick={record} loading={saving}>
          Record payment and renew
        </Button>
      </Form>
    </Modal>
  );
}
