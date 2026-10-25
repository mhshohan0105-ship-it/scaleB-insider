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
  Form,
  Input,
  Radio,
  Row,
  Select,
  Steps,
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
import { MoneyLine } from "@/components/invoices/InvoiceFormParts";
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

/** Positive = the client owes us; negative = we hold their money. */
function balanceText(v: ReturnType<typeof d>) {
  if (v.isZero()) return "Nothing due";
  return v.isNegative()
    ? `We owe ${formatMoney(v.negated().toFixed(2))}`
    : `Owes ${formatMoney(v.toFixed(2))}`;
}

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
  const [step, setStep] = useState(0);

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

  /** Checks the current step before moving on. */
  function next() {
    if (step === 0) {
      form
        .validateFields(["invoiceId", "date"])
        .then(() => {
          if (!chosen.length) message.error("Tick at least one line to refund");
          else setStep(1);
        })
        .catch(() => message.error("Please fix the highlighted fields"));
      return;
    }
    form
      .validateFields(["clientCharge", "method", "moneyAccountId", "returnAmount"])
      .then(() => {
        if (!figures) message.error("Check the amounts");
        else setStep(2);
      })
      .catch(() => message.error("Please fix the highlighted fields"));
  }

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
  ];
  const amountColumns: TableColumnsType<Line> = [
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
        <Steps
          current={step}
          style={{ marginBottom: 20 }}
          items={[
            { title: "Choose the lines", description: "Invoice and what to refund" },
            { title: "Amounts", description: "Charges and how the client is paid" },
            { title: "Check and save", description: "Balances after the refund" },
          ]}
        />

        <div hidden={step !== 0}>
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
                    children: (
                      <Link href={`/clients/${target.client.id}`}>{target.client.name}</Link>
                    ),
                  },
                  { key: "date", label: "Date", children: formatDate(target.date) },
                  { key: "net", label: "Total", children: formatMoney(target.netTotal) },
                  { key: "paid", label: "Received", children: formatMoney(target.paidAmount) },
                  {
                    key: "bal",
                    label: "Client balance",
                    children: balanceText(d(target.client.balance)),
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
        </div>

        <div hidden={step !== 1}>
          <div className="inv-layout">
            <div className="inv-main">
              <Card title="Amounts per line" style={{ marginBottom: 16 }}>
                <Table<Line>
                  rowKey="lineId"
                  size="small"
                  pagination={false}
                  columns={amountColumns}
                  dataSource={rows.filter((l) => values?.lines?.[l.index]?.selected)}
                  scroll={{ x: "max-content" }}
                />
              </Card>
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
            </div>
            <aside className="inv-aside">
              <Card title="How it adds up" style={{ marginBottom: 16 }}>
                {figures ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <MoneyLine
                      label="Sales taken back"
                      value={formatMoney(figures.clientRefundAmount.toFixed(2))}
                    />
                    <MoneyLine
                      label="Refund charge"
                      value={`- ${formatMoney(figures.clientCharge.toFixed(2))}`}
                    />
                    <MoneyLine
                      label="Credit to client"
                      value={formatMoney(figures.clientCredit.toFixed(2))}
                      strong
                    />
                    <MoneyLine
                      label="Back from vendors"
                      value={formatMoney(figures.vendorCredit.toFixed(2))}
                    />
                    <MoneyLine
                      label="Effect on profit"
                      value={formatMoney(figures.profitEffect.toFixed(2))}
                      strong
                      tone={figures.profitEffect.isNegative() ? "danger" : "success"}
                    />
                  </div>
                ) : (
                  <Alert type="warning" message="Check the amounts" />
                )}
              </Card>
            </aside>
          </div>
        </div>

        <div hidden={step !== 2}>
          {target && figures && (
            <>
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} md={8}>
                  <Card size="small" title="Client balance" style={{ height: "100%" }}>
                    <Typography.Text type="secondary">
                      {balanceText(d(target.client.balance))} →
                    </Typography.Text>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>
                      {balanceText(
                        d(target.client.balance)
                          .minus(figures.clientCredit)
                          .plus(cash ? d(values?.returnAmount) : d(0)),
                      )}
                    </div>
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" title="Back from vendors" style={{ height: "100%" }}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>
                      {formatMoney(figures.vendorCredit.toFixed(2))}
                    </div>
                    <Typography.Text type="secondary">
                      Lowers what you owe the vendor, or becomes an advance with them
                    </Typography.Text>
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" title="Effect on profit" style={{ height: "100%" }}>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: figures.profitEffect.isNegative() ? "#b42318" : "#067647",
                      }}
                    >
                      {formatMoney(figures.profitEffect.toFixed(2))}
                    </div>
                    <Typography.Text type="secondary">
                      {cash
                        ? `Pay back ${formatMoney(d(values?.returnAmount).toFixed(2))} now`
                        : "The credit stays on the client's account"}
                    </Typography.Text>
                  </Card>
                </Col>
              </Row>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message="Saving posts the refund to the books. To undo it later, void the refund; nothing is deleted."
              />
            </>
          )}
        </div>

        <div className="inv-actions">
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Step {step + 1} of 3
            {figures ? ` · Credit to client ${formatMoney(figures.clientCredit.toFixed(2))}` : ""}
          </Typography.Text>
          <div style={{ flex: 1 }} />
          <Link href={info.path}>
            <Button>Cancel</Button>
          </Link>
          {step > 0 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
          {step < 2 ? (
            <Button type="primary" disabled={!target} onClick={next}>
              Next
            </Button>
          ) : (
            <Button type="primary" loading={pending} onClick={submit} disabled={!target}>
              Save refund
            </Button>
          )}
        </div>
      </Form>
    </>
  );
}
