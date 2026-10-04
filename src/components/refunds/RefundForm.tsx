"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Flex,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Table,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { d } from "@/lib/calc/money";
import { calcRefund, cashReturnable } from "@/lib/calc/refund";
import { formatDate, formatMoney } from "@/lib/format";
import { INVOICE_TYPE_INFO, type InvoiceTypeKey } from "@/lib/invoiceTypes";
import { REFUND_TYPE_INFO, type RefundTypeKey } from "@/lib/refundTypes";
import { MoneyInput } from "@/components/MoneyInput";
import { PageHeader } from "@/components/PageHeader";
import { applyActionResult } from "@/components/formResult";
import {
  createRefundAction,
  refundTargetAction,
  refundableInvoicesAction,
} from "@/app/(app)/refunds/actions";
import type { RefundTarget } from "@/server/services/refund/postRefund";

interface LineValues {
  lineId: string;
  selected?: boolean;
  clientAmount?: string | null;
  vendorAmount?: string | null;
  vendorCharge?: string | null;
}

interface FormValues {
  invoiceId?: string;
  date?: Dayjs;
  clientCharge?: string | null;
  method?: "ADJUST_TO_BALANCE" | "CASH_RETURN";
  returnAmount?: string | null;
  moneyAccountId?: string | null;
  note?: string | null;
  lines?: LineValues[];
}

interface Props {
  type: RefundTypeKey;
  today: string;
  initialTarget: RefundTarget | null;
  accounts: { value: string; label: string }[];
}

type InvoiceOption = { value: string; label: string };

const nonZero = (v?: string | null) => !!v && d(v).greaterThan(0);

export function RefundForm({ type, today, initialTarget, accounts }: Props) {
  const info = REFUND_TYPE_INFO[type];
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<RefundTarget | null>(initialTarget);
  const [options, setOptions] = useState<InvoiceOption[]>(
    initialTarget
      ? [
          {
            value: initialTarget.id,
            label: `${initialTarget.number} · ${initialTarget.client.name}`,
          },
        ]
      : [],
  );
  const [searching, setSearching] = useState(false);
  const values = Form.useWatch([], form) as FormValues | undefined;
  const searchSeq = useRef(0);

  function search(q: string) {
    const seq = ++searchSeq.current;
    setSearching(true);
    refundableInvoicesAction(type, q).then((r) => {
      if (seq !== searchSeq.current) return;
      setSearching(false);
      if (r.ok)
        setOptions(
          r.data.map((i) => ({
            value: i.id,
            label: `${i.number} · ${i.clientName} · ${formatDate(i.date)} · ${formatMoney(i.netTotal)}`,
          })),
        );
    });
  }

  useEffect(() => {
    if (!initialTarget) search("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function linesFor(t: RefundTarget): LineValues[] {
    const open = t.lines.filter((l) => nonZero(l.clientLeft) || nonZero(l.vendorLeft));
    return t.lines.map((l) => ({
      lineId: l.lineId,
      selected: open.length === 1 && open[0]!.lineId === l.lineId,
      clientAmount: l.clientLeft,
      vendorAmount: l.vendorLeft,
      vendorCharge: "0",
    }));
  }

  useEffect(() => {
    if (initialTarget) form.setFieldValue("lines", linesFor(initialTarget));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickInvoice(id: string) {
    setTarget(null);
    form.setFieldValue("lines", []);
    refundTargetAction(type, id).then((r) => {
      if (!r.ok) {
        message.error(r.error);
        return;
      }
      setTarget(r.data);
      form.setFieldValue("lines", linesFor(r.data));
    });
  }

  const chosen = (values?.lines ?? []).filter((l) => l?.selected);
  const figures = useMemo(() => {
    try {
      return calcRefund(
        chosen.map((l) => {
          const line = target?.lines.find((x) => x.lineId === l.lineId);
          return {
            clientAmount: info.partial ? l.clientAmount || 0 : (line?.clientLeft ?? 0),
            vendorAmount: info.partial ? l.vendorAmount || 0 : (line?.vendorLeft ?? 0),
            vendorCharge: l.vendorCharge || 0,
          };
        }),
        values?.clientCharge || 0,
      );
    } catch {
      return null;
    }
  }, [chosen, values?.clientCharge, target, info.partial]);

  const payable =
    target && figures ? cashReturnable(target.client.balance, figures.clientCredit) : null;
  const cash = values?.method === "CASH_RETURN";

  function submit() {
    form
      .validateFields()
      .then((v) => {
        const lines = (v.lines ?? []).filter((l) => l.selected);
        if (!lines.length) {
          message.error("Tick at least one line to refund");
          return;
        }
        const payload = {
          ...v,
          date: v.date?.format("YYYY-MM-DD"),
          lines: lines.map(({ selected: _s, ...rest }) => {
            void _s;
            return rest;
          }),
        };
        startTransition(async () => {
          const result = await createRefundAction(type, payload);
          if (!applyActionResult(result, form, message)) return;
          if (!result.ok) return;
          message.success(`Refund ${result.data.number} saved`);
          router.push(`${info.path}/${result.data.id}`);
          router.refresh();
        });
      })
      .catch(() => message.error("Please fix the highlighted fields"));
  }

  type Line = RefundTarget["lines"][number] & { index: number };
  const rows: Line[] = (target?.lines ?? []).map((l, index) => ({ ...l, index }));
  const columns: TableColumnsType<Line> = [
    {
      title: "Refund",
      key: "sel",
      width: 70,
      render: (_, l) => (
        <>
          <Form.Item name={["lines", l.index, "lineId"]} hidden>
            <Input />
          </Form.Item>
          <Form.Item name={["lines", l.index, "selected"]} valuePropName="checked" noStyle>
            <Checkbox
              aria-label={`Refund ${l.description}`}
              disabled={!nonZero(l.clientLeft) && !nonZero(l.vendorLeft)}
            />
          </Form.Item>
        </>
      ),
    },
    {
      title: "Line",
      key: "line",
      render: (_, l) => (
        <>
          {l.description}
          <div style={{ fontSize: 12, color: "#888" }}>
            {[l.detail, l.vendorName].filter(Boolean).join(" · ")}
          </div>
        </>
      ),
    },
    {
      title: "Client price (left)",
      key: "cp",
      align: "right",
      render: (_, l) => (
        <>
          {formatMoney(l.clientPrice)}
          {l.clientLeft !== l.clientPrice && (
            <div style={{ fontSize: 12, color: "#888" }}>left {formatMoney(l.clientLeft)}</div>
          )}
        </>
      ),
    },
    {
      title: "Cost (left)",
      key: "cost",
      align: "right",
      render: (_, l) => (
        <>
          {formatMoney(l.purchasePrice)}
          {l.vendorLeft !== l.purchasePrice && (
            <div style={{ fontSize: 12, color: "#888" }}>left {formatMoney(l.vendorLeft)}</div>
          )}
        </>
      ),
    },
    ...(info.partial
      ? [
          {
            title: "Refund to client",
            key: "ca",
            width: 150,
            render: (_: unknown, l: Line) => (
              <Form.Item name={["lines", l.index, "clientAmount"]} noStyle>
                <MoneyInput aria-label={`Client amount ${l.index + 1}`} />
              </Form.Item>
            ),
          },
          {
            title: "Back from vendor",
            key: "va",
            width: 150,
            render: (_: unknown, l: Line) => (
              <Form.Item name={["lines", l.index, "vendorAmount"]} noStyle>
                <MoneyInput aria-label={`Vendor amount ${l.index + 1}`} disabled={!l.vendorName} />
              </Form.Item>
            ),
          },
        ]
      : []),
    {
      title: "Vendor keeps",
      key: "vc",
      width: 150,
      render: (_, l) => (
        <Form.Item name={["lines", l.index, "vendorCharge"]} noStyle>
          <MoneyInput aria-label={`Vendor charge ${l.index + 1}`} disabled={!l.vendorName} />
        </Form.Item>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={`${info.label} Refund`}
        description={
          info.partial
            ? "Refund part of any invoice line: enter how much goes back to the client and how much the vendor returns."
            : "Refund whole lines. Enter what the vendor keeps and what you keep from the client."
        }
      />
      <Form<FormValues>
        form={form}
        name="refund"
        layout="vertical"
        requiredMark="optional"
        initialValues={{
          invoiceId: initialTarget?.id,
          date: dayjs(today),
          method: "ADJUST_TO_BALANCE",
          lines: [],
        }}
        onValuesChange={(changed: Partial<FormValues>) => {
          // Suggest paying back what the client can take in cash.
          if (changed.method === "CASH_RETURN" && payable)
            form.setFieldValue("returnAmount", payable.toFixed(2));
        }}
      >
        <Card title="Invoice" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} lg={14}>
              <Form.Item
                label="Invoice"
                name="invoiceId"
                rules={[{ required: true, message: "Choose the invoice" }]}
              >
                <Select
                  showSearch
                  filterOption={false}
                  onSearch={search}
                  loading={searching}
                  options={options}
                  onChange={pickInvoice}
                  placeholder="Invoice no., client, ticket no. or passenger"
                  notFoundContent={searching ? "Searching..." : "No refundable invoices"}
                />
              </Form.Item>
            </Col>
            <Col xs={12} lg={5}>
              <Form.Item
                label="Refund date"
                name="date"
                rules={[{ required: true, message: "Choose a date" }]}
              >
                <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} allowClear={false} />
              </Form.Item>
            </Col>
          </Row>
          {target && (
            <Descriptions
              size="small"
              column={{ xs: 1, md: 3 }}
              items={[
                {
                  key: "inv",
                  label: "Invoice",
                  children: (
                    <Link
                      href={`${INVOICE_TYPE_INFO[target.type as InvoiceTypeKey].path}/${target.id}`}
                    >
                      {target.number}
                    </Link>
                  ),
                },
                {
                  key: "client",
                  label: "Client",
                  children: <Link href={`/clients/${target.client.id}`}>{target.client.name}</Link>,
                },
                { key: "date", label: "Date", children: formatDate(target.date) },
                { key: "net", label: "Total", children: formatMoney(target.netTotal) },
                { key: "paid", label: "Received", children: formatMoney(target.paidAmount) },
                {
                  key: "bal",
                  label: "Client balance",
                  children: d(target.client.balance).isNegative()
                    ? `${formatMoney(target.client.balance.slice(1))} advance`
                    : `${formatMoney(target.client.balance)} due`,
                },
              ]}
            />
          )}
        </Card>

        <Card title="Lines to refund" style={{ marginBottom: 16 }}>
          {target ? (
            <Table<Line>
              rowKey="lineId"
              size="small"
              pagination={false}
              columns={columns}
              dataSource={rows}
              scroll={{ x: "max-content" }}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Choose an invoice first" />
          )}
        </Card>

        <Row gutter={16}>
          <Col xs={24} lg={12}>
            <Card title="Client" style={{ marginBottom: 16 }}>
              <Form.Item label="Refund charge (kept from the client)" name="clientCharge">
                <MoneyInput placeholder="0.00" />
              </Form.Item>
              <Form.Item label="Client gets the money" name="method">
                <Radio.Group
                  options={[
                    { value: "ADJUST_TO_BALANCE", label: "Keep as credit on the account" },
                    { value: "CASH_RETURN", label: "Pay back now" },
                  ]}
                />
              </Form.Item>
              {cash && (
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item
                      label="Pay from"
                      name="moneyAccountId"
                      rules={[{ required: true, message: "Choose the account" }]}
                    >
                      <Select showSearch optionFilterProp="label" options={accounts} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="Amount paid back"
                      name="returnAmount"
                      rules={[{ required: true, message: "Enter the amount" }]}
                      extra={
                        payable
                          ? `Up to ${formatMoney(payable.toFixed(2))} (the client's credit after this refund)`
                          : undefined
                      }
                    >
                      <MoneyInput />
                    </Form.Item>
                  </Col>
                </Row>
              )}
              <Form.Item label="Note" name="note">
                <Input.TextArea rows={2} maxLength={500} />
              </Form.Item>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Summary" style={{ marginBottom: 16 }}>
              {figures ? (
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  items={[
                    {
                      key: "r",
                      label: "Sales taken back",
                      children: formatMoney(figures.clientRefundAmount.toFixed(2)),
                    },
                    {
                      key: "c",
                      label: "Refund charge",
                      children: `- ${formatMoney(figures.clientCharge.toFixed(2))}`,
                    },
                    {
                      key: "cc",
                      label: "Credit to client",
                      children: <strong>{formatMoney(figures.clientCredit.toFixed(2))}</strong>,
                    },
                    {
                      key: "vc",
                      label: "Back from vendors",
                      children: formatMoney(figures.vendorCredit.toFixed(2)),
                    },
                    {
                      key: "p",
                      label: "Effect on profit",
                      children: (
                        <Typography.Text
                          type={figures.profitEffect.isNegative() ? "danger" : "success"}
                        >
                          {formatMoney(figures.profitEffect.toFixed(2))}
                        </Typography.Text>
                      ),
                    },
                  ]}
                />
              ) : (
                <Alert type="warning" message="Check the amounts" />
              )}
            </Card>
          </Col>
        </Row>

        <Flex gap={8} justify="flex-end" style={{ marginBottom: 24 }}>
          <Link href={info.path}>
            <Button>Cancel</Button>
          </Link>
          <Button type="primary" loading={pending} onClick={submit} disabled={!target}>
            Save refund
          </Button>
        </Flex>
      </Form>
    </>
  );
}
