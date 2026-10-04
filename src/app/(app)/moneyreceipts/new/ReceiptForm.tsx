"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Flex,
  Form,
  Input,
  Row,
  Select,
  Switch,
  Table,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { autoAllocate } from "@/lib/calc/allocation";
import { Decimal, d } from "@/lib/calc/money";
import { formatDate, formatMoney } from "@/lib/format";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/schemas/invoices";
import type { DueInvoiceRow } from "@/server/services/payments/receiptService";
import { ChequeFields, withChequeDate } from "@/components/payments/ChequeFields";
import { MoneyInput } from "@/components/MoneyInput";
import { PageHeader } from "@/components/PageHeader";
import { PartySelect } from "@/components/PartySelect";
import { applyActionResult } from "@/components/formResult";
import { createMoneyReceiptAction, dueInvoicesAction } from "../actions";

interface FormValues {
  clientId?: string | null;
  date: Dayjs;
  moneyAccountId?: string;
  paymentMethod: string;
  amount?: string | null;
  transactionCharge?: string | null;
  reference?: string;
  note?: string;
}

const KIND_TO_METHOD: Record<string, string> = {
  CASH: "CASH",
  BANK: "BANK",
  MOBILE_BANKING: "MOBILE",
  CREDIT_CARD: "CARD",
};

export function ReceiptForm({
  today,
  initialClientId,
  accounts,
}: {
  today: string;
  initialClientId: string | null;
  accounts: { value: string; label: string; kind: string }[];
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [pending, startTransition] = useTransition();
  const [dues, setDues] = useState<DueInvoiceRow[]>([]);
  const [loadingDues, setLoadingDues] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualAmounts, setManualAmounts] = useState<Record<string, string | null>>({});

  const clientId = Form.useWatch("clientId", form);
  const amount = Form.useWatch("amount", form);
  const charge = Form.useWatch("transactionCharge", form);

  useEffect(() => {
    setManual(false);
    setManualAmounts({});
    if (!clientId) {
      setDues([]);
      return;
    }
    setLoadingDues(true);
    void dueInvoicesAction(clientId).then((r) => {
      setLoadingDues(false);
      setDues(r.ok ? r.data : []);
    });
  }, [clientId]);

  const auto = useMemo(() => {
    try {
      return autoAllocate(amount || 0, dues);
    } catch {
      return { allocations: [], advance: new Decimal(0) };
    }
  }, [amount, dues]);

  const allocationFor = (invoiceId: string): string | null => {
    if (manual) return manualAmounts[invoiceId] ?? null;
    const a = auto.allocations.find((x) => x.invoiceId === invoiceId);
    return a ? a.amount.toFixed(2) : null;
  };

  let allocated = new Decimal(0);
  let received = new Decimal(0);
  let chargeValue = new Decimal(0);
  try {
    allocated = dues.reduce((s, x) => s.plus(d(allocationFor(x.invoiceId))), new Decimal(0));
    received = d(amount);
    chargeValue = d(charge);
  } catch {
    /* half typed number */
  }
  const advance = received.minus(allocated);
  const totalDue = dues.reduce((s, x) => s.plus(x.due), new Decimal(0));

  function submit(values: FormValues) {
    const allocations = dues
      .map((x) => ({ invoiceId: x.invoiceId, amount: allocationFor(x.invoiceId) }))
      .filter(
        (a): a is { invoiceId: string; amount: string } => !!a.amount && d(a.amount).greaterThan(0),
      );
    startTransition(async () => {
      const result = await createMoneyReceiptAction({
        ...withChequeDate(values as unknown as Record<string, unknown>),
        date: values.date.format("YYYY-MM-DD"),
        allocations,
      });
      if (!applyActionResult(result, form, message)) return;
      message.success(`Receipt ${result.data.number} saved`);
      router.push(`/moneyreceipts/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader title="New Money Receipt" description="Record money received from a client." />
      <Form<FormValues>
        form={form}
        name="receipt"
        layout="vertical"
        requiredMark="optional"
        initialValues={{
          date: dayjs(today),
          clientId: initialClientId,
          paymentMethod: "CASH",
          moneyAccountId: accounts.find((a) => a.kind === "CASH")?.value,
        }}
        onValuesChange={(changed: Partial<FormValues>) => {
          if (changed.moneyAccountId) {
            const kind = accounts.find((a) => a.value === changed.moneyAccountId)?.kind;
            if (kind) form.setFieldValue("paymentMethod", KIND_TO_METHOD[kind] ?? "CASH");
          }
        }}
        onFinish={submit}
      >
        <Row gutter={16}>
          <Col xs={24} xl={10}>
            <Card title="Receipt" style={{ marginBottom: 16 }}>
              <Form.Item
                label="Client"
                name="clientId"
                rules={[{ required: true, message: "Choose a client" }]}
              >
                <PartySelect party="clients" id="receipt_clientId" />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="Date" name="date" rules={[{ required: true }]}>
                    <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Amount received"
                    name="amount"
                    rules={[{ required: true, message: "Enter the amount" }]}
                  >
                    <MoneyInput />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Into account"
                    name="moneyAccountId"
                    rules={[{ required: true, message: "Choose the account" }]}
                  >
                    <Select showSearch optionFilterProp="label" options={accounts} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Method" name="paymentMethod">
                    <Select options={[...PAYMENT_METHOD_OPTIONS]} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Transaction charge"
                    name="transactionCharge"
                    tooltip="Fee the bank or wallet kept. The client is still credited the full amount."
                  >
                    <MoneyInput placeholder="0.00" />
                  </Form.Item>
                </Col>
                <ChequeFields />
                <Col span={12}>
                  <Form.Item label="Reference" name="reference">
                    <Input maxLength={80} placeholder="TrxID, deposit slip, ..." />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label="Note" name="note">
                    <Input.TextArea rows={2} maxLength={500} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} xl={14}>
            <Card
              title="Apply to invoices"
              style={{ marginBottom: 16 }}
              extra={
                <Flex align="center" gap={8}>
                  <Typography.Text type="secondary">Oldest first</Typography.Text>
                  <Switch
                    checked={!manual}
                    onChange={(on) => {
                      if (!on) {
                        setManualAmounts(
                          Object.fromEntries(
                            dues.map((x) => [x.invoiceId, allocationFor(x.invoiceId)]),
                          ),
                        );
                      }
                      setManual(!on);
                    }}
                  />
                </Flex>
              }
            >
              {!clientId ? (
                <Typography.Text type="secondary">
                  Choose a client to see their unpaid invoices.
                </Typography.Text>
              ) : (
                <Table
                  rowKey="invoiceId"
                  size="small"
                  loading={loadingDues}
                  pagination={false}
                  dataSource={dues}
                  locale={{
                    emptyText: "No unpaid invoices. The whole amount will be kept as advance.",
                  }}
                  columns={[
                    { title: "Date", dataIndex: "date", render: (v: string) => formatDate(v) },
                    { title: "Invoice", dataIndex: "number" },
                    {
                      title: "Due",
                      dataIndex: "due",
                      align: "right",
                      render: (v: string) => formatMoney(v),
                    },
                    {
                      title: "Apply",
                      key: "apply",
                      width: 150,
                      render: (_, row) =>
                        manual ? (
                          <MoneyInput
                            size="small"
                            aria-label={`Apply to ${row.number}`}
                            value={manualAmounts[row.invoiceId] ?? null}
                            onChange={(v) =>
                              setManualAmounts((m) => ({ ...m, [row.invoiceId]: v }))
                            }
                          />
                        ) : (
                          formatMoney(allocationFor(row.invoiceId) ?? "0")
                        ),
                    },
                  ]}
                />
              )}
              <Descriptions
                style={{ marginTop: 16 }}
                bordered
                size="small"
                column={1}
                items={[
                  { key: "due", label: "Total due", children: formatMoney(totalDue) },
                  { key: "alloc", label: "Applied to invoices", children: formatMoney(allocated) },
                  {
                    key: "adv",
                    label: "Kept as advance",
                    children: (
                      <Typography.Text type={advance.isNegative() ? "danger" : undefined}>
                        {formatMoney(advance)}
                      </Typography.Text>
                    ),
                  },
                  ...(chargeValue.greaterThan(0)
                    ? [
                        {
                          key: "net",
                          label: "Lands in the account",
                          children: formatMoney(received.minus(chargeValue)),
                        },
                      ]
                    : []),
                ]}
              />
              {advance.isNegative() && (
                <Alert
                  style={{ marginTop: 12 }}
                  type="error"
                  showIcon
                  message="Applied more than the amount received."
                />
              )}
            </Card>
          </Col>
        </Row>
        <Flex gap={8} justify="flex-end" style={{ marginBottom: 24 }}>
          <Link href="/moneyreceipts">
            <Button>Cancel</Button>
          </Link>
          <Button
            type="primary"
            htmlType="submit"
            loading={pending}
            disabled={advance.isNegative()}
          >
            Save receipt
          </Button>
        </Flex>
      </Form>
    </>
  );
}
