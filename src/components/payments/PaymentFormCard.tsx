"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Card, Col, DatePicker, Form, Input, Row, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type { ActionResult } from "@/lib/actionResult";
import type { PartyKey } from "@/lib/masters";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/schemas/invoices";
import { formatMoney } from "@/lib/format";
import { ChequeFields, withChequeDate } from "@/components/payments/ChequeFields";
import { MoneyInput } from "@/components/MoneyInput";
import { PartySelect } from "@/components/PartySelect";
import { applyActionResult } from "@/components/formResult";

export interface AccountOption {
  value: string;
  label: string;
  kind: string;
  balance: string;
}

interface Props {
  title: string;
  party: PartyKey;
  partyField: "vendorId" | "partyId";
  partyLabel: string;
  accountLabel: string;
  submitLabel: string;
  accounts: AccountOption[];
  today: string;
  /** Show method / charge / reference (payments) or not (advance returns). */
  full?: boolean;
  help?: ReactNode;
  onSubmit: (
    values: Record<string, unknown>,
  ) => Promise<ActionResult<{ id: string; number: string }>>;
}

const KIND_TO_METHOD: Record<string, string> = {
  CASH: "CASH",
  BANK: "BANK",
  MOBILE_BANKING: "MOBILE",
  CREDIT_CARD: "CARD",
};

/** Small "money in / money out" form used by vendor payments and advance returns. */
export function PaymentFormCard(props: Props) {
  const {
    title,
    party,
    partyField,
    partyLabel,
    accountLabel,
    submitLabel,
    accounts,
    today,
    full,
    help,
    onSubmit,
  } = props;
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [pending, startTransition] = useTransition();

  function submit(values: Record<string, unknown> & { date: Dayjs }) {
    startTransition(async () => {
      const result = await onSubmit({
        ...withChequeDate(values),
        date: values.date.format("YYYY-MM-DD"),
      });
      if (!applyActionResult(result, form, message)) return;
      message.success(`${result.data.number} saved`);
      form.resetFields();
      router.refresh();
    });
  }

  const options = accounts.map((a) => ({
    value: a.value,
    label: `${a.label} (${formatMoney(a.balance)})`,
  }));

  return (
    <Card title={title} style={{ marginBottom: 16 }}>
      {help}
      <Form
        form={form}
        name={`${party}Payment`}
        layout="vertical"
        requiredMark="optional"
        initialValues={{ date: dayjs(today), paymentMethod: "BANK" }}
        onValuesChange={(changed: Record<string, unknown>) => {
          if (typeof changed.moneyAccountId === "string") {
            const kind = accounts.find((a) => a.value === changed.moneyAccountId)?.kind;
            if (kind) form.setFieldValue("paymentMethod", KIND_TO_METHOD[kind] ?? "BANK");
          }
        }}
        onFinish={submit}
      >
        <Form.Item
          label={partyLabel}
          name={partyField}
          rules={[{ required: true, message: `Choose a ${party.slice(0, -1)}` }]}
        >
          <PartySelect party={party} id={`${party}Payment_${partyField}`} />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Date" name="date" rules={[{ required: true }]}>
              <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Amount"
              name="amount"
              rules={[{ required: true, message: "Enter the amount" }]}
            >
              <MoneyInput />
            </Form.Item>
          </Col>
          <Col span={full ? 12 : 24}>
            <Form.Item
              label={accountLabel}
              name="moneyAccountId"
              rules={[{ required: true, message: "Choose the account" }]}
            >
              <Select showSearch optionFilterProp="label" options={options} />
            </Form.Item>
          </Col>
          {full && (
            <>
              <Col span={12}>
                <Form.Item label="Method" name="paymentMethod">
                  <Select options={[...PAYMENT_METHOD_OPTIONS]} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Transaction charge"
                  name="transactionCharge"
                  tooltip="Bank or wallet fee on top of the amount"
                >
                  <MoneyInput placeholder="0.00" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Reference" name="reference">
                  <Input maxLength={80} />
                </Form.Item>
              </Col>
              <ChequeFields />
            </>
          )}
          <Col span={24}>
            <Form.Item label="Note" name="note">
              <Input.TextArea rows={2} maxLength={500} />
            </Form.Item>
          </Col>
        </Row>
        <Button type="primary" htmlType="submit" block loading={pending}>
          {submitLabel}
        </Button>
      </Form>
    </Card>
  );
}
