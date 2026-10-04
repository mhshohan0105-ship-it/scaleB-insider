"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Flex,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import Decimal from "decimal.js";
import { formatDate, formatMoney } from "@/lib/format";
import type { ListParams } from "@/lib/listParams";
import type { TransferRow } from "@/server/services/accounts/transferService";
import { DataTable } from "@/components/DataTable";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { MoneyInput } from "@/components/MoneyInput";
import { PageHeader } from "@/components/PageHeader";
import { applyActionResult } from "@/components/formResult";
import { createBalanceTransferAction, voidBalanceTransferAction } from "../actions";

interface AccountOption {
  value: string;
  label: string;
  balance: string;
  kind: string;
}

interface Props {
  accounts: AccountOption[];
  transfers: { rows: TransferRow[]; total: number };
  params: ListParams;
  today: string;
  canCreate: boolean;
  canVoid: boolean;
}

interface FormValues {
  date: Dayjs;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  charge?: string | null;
  note?: string;
}

export function BalanceTransferPage({
  accounts,
  transfers,
  params,
  today,
  canCreate,
  canVoid,
}: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [voidForm] = Form.useForm<{ reason: string }>();
  const [pending, startTransition] = useTransition();
  const [voiding, setVoiding] = useState<TransferRow | null>(null);
  const fromId = Form.useWatch("fromAccountId", form);
  const amount = Form.useWatch("amount", form);
  const charge = Form.useWatch("charge", form);
  const from = accounts.find((a) => a.value === fromId);

  const accountOptions = accounts.map((a) => ({
    value: a.value,
    label: `${a.label} (${formatMoney(a.balance)})`,
  }));

  let totalOut: Decimal | null = null;
  try {
    totalOut = new Decimal(amount || 0).plus(charge || 0);
  } catch {
    totalOut = null;
  }

  function submit(values: FormValues) {
    startTransition(async () => {
      const result = await createBalanceTransferAction({
        ...values,
        date: values.date.format("YYYY-MM-DD"),
      });
      if (applyActionResult(result, form, message)) {
        message.success(`Transfer ${result.data.number} saved`);
        form.resetFields();
        router.refresh();
      }
    });
  }

  async function confirmVoid() {
    const values = await voidForm.validateFields();
    const r = await voidBalanceTransferAction(voiding!.id, values);
    if (applyActionResult(r, voidForm, message, "Transfer voided")) {
      setVoiding(null);
      router.refresh();
    }
  }

  const columns: TableColumnsType<TransferRow> = [
    { title: "Date", dataIndex: "date", key: "date", render: (d: string) => formatDate(d) },
    { title: "No.", dataIndex: "number", key: "number" },
    {
      title: "From → To",
      key: "route",
      render: (_, t) => (
        <>
          {t.fromName} → {t.toName}
          {t.note && (
            <div>
              <Typography.Text type="secondary">{t.note}</Typography.Text>
            </div>
          )}
        </>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
    {
      title: "Charge",
      dataIndex: "charge",
      key: "charge",
      align: "right",
      render: (v: string) => (v === "0.00" ? "-" : formatMoney(v)),
    },
    {
      title: "Status",
      key: "status",
      render: (_, t) =>
        t.status === "VOID" ? (
          <Tag color="red" title={t.voidReason ?? undefined}>
            Void
          </Tag>
        ) : (
          <Tag color="green">Posted</Tag>
        ),
    },
    ...(canVoid
      ? [
          {
            key: "actions",
            align: "right" as const,
            render: (_: unknown, t: TransferRow) =>
              t.status === "POSTED" && (
                <Button type="link" danger size="small" onClick={() => setVoiding(t)}>
                  Void
                </Button>
              ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader title="Balance Transfer" description="Move money between your own accounts." />
      <Row gutter={16}>
        {canCreate && (
          <Col xs={24} xl={9}>
            <Card title="New transfer" style={{ marginBottom: 16 }}>
              <Form<FormValues>
                form={form}
                layout="vertical"
                onFinish={submit}
                initialValues={{ date: dayjs(today), charge: "0" }}
                requiredMark="optional"
              >
                <Form.Item
                  label="Date"
                  name="date"
                  rules={[{ required: true, message: "Choose a date" }]}
                >
                  <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
                </Form.Item>
                <Form.Item
                  label="From account"
                  name="fromAccountId"
                  rules={[{ required: true, message: "Choose the account to move money from" }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={accountOptions}
                    placeholder="Select account"
                  />
                </Form.Item>
                <Form.Item
                  label="To account"
                  name="toAccountId"
                  dependencies={["fromAccountId"]}
                  rules={[
                    { required: true, message: "Choose the account to move money to" },
                    ({ getFieldValue }) => ({
                      validator: (_, v) =>
                        v && v === getFieldValue("fromAccountId")
                          ? Promise.reject(new Error("Choose a different account"))
                          : Promise.resolve(),
                    }),
                  ]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={accountOptions}
                    placeholder="Select account"
                  />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={14}>
                    <Form.Item
                      label="Amount"
                      name="amount"
                      rules={[{ required: true, message: "Enter an amount" }]}
                    >
                      <MoneyInput placeholder="0.00" />
                    </Form.Item>
                  </Col>
                  <Col span={10}>
                    <Form.Item
                      label="Charge"
                      name="charge"
                      tooltip="Bank or transfer fee, paid from the source account"
                    >
                      <MoneyInput placeholder="0.00" />
                    </Form.Item>
                  </Col>
                </Row>
                {from && totalOut && (
                  <Typography.Paragraph type="secondary">
                    {from.label} will go from {formatMoney(from.balance)} to{" "}
                    <strong>{formatMoney(new Decimal(from.balance).minus(totalOut))}</strong>.
                  </Typography.Paragraph>
                )}
                <Form.Item label="Note" name="note">
                  <Input.TextArea rows={2} maxLength={500} />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={pending} block>
                  Transfer
                </Button>
              </Form>
            </Card>
          </Col>
        )}
        <Col xs={24} xl={canCreate ? 15 : 24}>
          <Card title="Transfer history">
            <Flex gap={8} style={{ marginBottom: 12 }}>
              <DateRangeFilter from={params.from} to={params.to} />
            </Flex>
            <DataTable<TransferRow>
              rows={transfers.rows}
              total={transfers.total}
              page={params.page}
              pageSize={params.pageSize}
              columns={columns}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        open={voiding !== null}
        title={`Void transfer ${voiding?.number ?? ""}`}
        okText="Void transfer"
        okButtonProps={{ danger: true }}
        onOk={confirmVoid}
        onCancel={() => setVoiding(null)}
        destroyOnHidden
      >
        <Typography.Paragraph>
          The money goes back to {voiding?.fromName}. The transfer stays on record, marked void.
        </Typography.Paragraph>
        <Form form={voidForm} layout="vertical" preserve={false}>
          <Form.Item
            label="Reason"
            name="reason"
            rules={[{ required: true, min: 3, message: "Give a reason" }]}
          >
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
