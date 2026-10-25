"use client";

// Building blocks shared by every invoice form (approved layout): the sticky
// summary with discount / service charge / VAT and the printed-invoice
// choices, "Receive payment now", and the sticky action bar.
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Flex,
  Form,
  Input,
  Row,
  Select,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { Dayjs } from "dayjs";
import type { InvoiceTotals } from "@/lib/calc/invoiceTotals";
import { d } from "@/lib/calc/money";
import { formatMoney } from "@/lib/format";
import { MoneyInput } from "@/components/MoneyInput";
import { THEME } from "@/components/Providers";

export interface AccountOption {
  value: string;
  label: string;
  kind: string;
}

export interface PaymentFormValues {
  moneyAccountId?: string;
  paymentMethod?: string;
  amount?: string | null;
  date?: Dayjs | null;
  reference?: string | null;
}

type Money = { toFixed(n: number): string; isNegative(): boolean };

const METHOD_BY_KIND: Record<string, string> = {
  CASH: "CASH",
  BANK: "BANK",
  MOBILE_BANKING: "MOBILE",
  CREDIT_CARD: "CARD",
};

/** The payment method that goes with a money account (cash -> Cash, bKash -> Mobile...). */
export function methodForAccount(accounts: AccountOption[], id: string | undefined) {
  const kind = accounts.find((a) => a.value === id)?.kind;
  return kind ? METHOD_BY_KIND[kind] : undefined;
}

/** The `payment` part of an invoice payload: only when switched on and posting. */
export function paymentPayload(
  payment: PaymentFormValues | undefined,
  on: boolean,
  iso: (v?: Dayjs | null) => string | null,
) {
  return on && payment ? { ...payment, date: iso(payment.date) } : null;
}

const money = (v: { toFixed(n: number): string } | null | undefined) =>
  v ? formatMoney(v.toFixed(2)) : "-";

export function MoneyLine({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "success" | "danger";
}) {
  return (
    <Flex justify="space-between" style={{ fontSize: 14, fontWeight: strong ? 600 : 400 }}>
      <span>{label}</span>
      <Typography.Text strong={strong} type={tone} style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Typography.Text>
    </Flex>
  );
}

export interface SummaryRow {
  key: string | number;
  label: string;
  sub?: string | null;
  sales: string | null;
  profit: Money | null;
}

/** Right-hand column: lines with sales and profit, money inputs, totals, print choices. */
export function InvoiceSummaryAside({
  rows,
  rowsTitle,
  totals,
  received,
  showExtraFeeOption = false,
}: {
  rows: SummaryRow[];
  rowsTitle: string;
  totals: InvoiceTotals | null;
  /** Amount of "Receive payment now", or null when it is off. */
  received: ReturnType<typeof d> | null;
  showExtraFeeOption?: boolean;
}) {
  const net = totals ? d(totals.netTotal.toFixed(2)) : null;
  const due = net ? net.minus(received ?? d(0)) : null;
  const options: [string, string][] = [
    ["showPrevDue", "Show previous due"],
    ["showDiscount", "Show discount"],
    ...(showExtraFeeOption ? ([["showExtraFee", "Show extra fee"]] as [string, string][]) : []),
  ];

  return (
    <aside className="inv-aside">
      <Card
        title="Summary"
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: 0 } }}
        extra={
          due && due.greaterThan(0) ? (
            <Tag color="red">Due {formatMoney(due.toFixed(2))}</Tag>
          ) : net && net.greaterThan(0) ? (
            <Tag color="green">Paid in full</Tag>
          ) : null
        }
      >
        <Table
          size="small"
          pagination={false}
          dataSource={rows}
          columns={[
            {
              title: rowsTitle,
              dataIndex: "label",
              render: (v: string, r: SummaryRow) => (
                <span>
                  {v}
                  {r.sub && (
                    <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                      {r.sub}
                    </Typography.Text>
                  )}
                </span>
              ),
            },
            {
              title: "Sales",
              dataIndex: "sales",
              align: "right",
              render: (v: string | null) => v ?? "-",
            },
            {
              title: "Profit",
              dataIndex: "profit",
              align: "right",
              render: (v: Money | null) =>
                v ? (
                  <Typography.Text type={v.isNegative() ? "danger" : "success"}>
                    {formatMoney(v.toFixed(2))}
                  </Typography.Text>
                ) : (
                  "-"
                ),
            },
          ]}
        />
        <div style={{ padding: "16px 20px", display: "grid", gap: 12 }}>
          <MoneyLine label="Subtotal" value={money(totals?.subtotal)} />
          <Row gutter={8}>
            <Col span={8}>
              <Form.Item label="Discount" name="discount" style={{ marginBottom: 0 }}>
                <MoneyInput placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Service charge" name="serviceCharge" style={{ marginBottom: 0 }}>
                <MoneyInput placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="VAT" name="vat" style={{ marginBottom: 0 }}>
                <MoneyInput placeholder="0.00" />
              </Form.Item>
            </Col>
          </Row>
          <Flex
            justify="space-between"
            align="baseline"
            style={{ borderTop: `1px solid ${THEME.line}`, paddingTop: 12 }}
          >
            <span style={{ fontWeight: 600 }}>Net total</span>
            <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {money(totals?.netTotal)}
            </span>
          </Flex>
          {received && <MoneyLine label="Received now" value={`- ${money(received)}`} />}
          <MoneyLine
            label="Invoice due"
            value={money(due)}
            strong
            tone={due && due.greaterThan(0) ? "danger" : undefined}
          />
          <MoneyLine label="Payable to vendors" value={money(totals?.totalCost)} />
          <MoneyLine
            label="Profit"
            value={money(totals?.profit)}
            strong
            tone={totals && d(totals.profit).isNegative() ? "danger" : "success"}
          />
        </div>
      </Card>

      <Card title="On the printed invoice" size="small" style={{ marginBottom: 16 }}>
        {options.map(([name, label]) => (
          <Flex key={name} justify="space-between" align="center" style={{ marginBottom: 10 }}>
            <span>{label}</span>
            <Form.Item name={name} valuePropName="checked" noStyle>
              <Switch size="small" aria-label={label} />
            </Form.Item>
          </Flex>
        ))}
        <Form.Item label="Reference" name="reference">
          <Input maxLength={100} placeholder="e.g. corporate PO number" />
        </Form.Item>
        <Form.Item label="Note" name="note" style={{ marginBottom: 0 }}>
          <Input.TextArea rows={2} maxLength={1000} placeholder="Shown on the invoice" />
        </Form.Item>
      </Card>
    </aside>
  );
}

/** "Receive payment now": a money receipt written with the invoice. */
export function ReceivePaymentCard({
  accounts,
  on,
  onChange,
}: {
  accounts: AccountOption[];
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <Card
      style={{ marginBottom: 16 }}
      title={
        <Flex justify="space-between" align="center">
          <span>
            Receive payment now
            <Typography.Text
              type="secondary"
              style={{ fontWeight: 400, fontSize: 13, marginLeft: 8 }}
            >
              A money receipt is made with the invoice
            </Typography.Text>
          </span>
          <Switch checked={on} onChange={onChange} aria-label="Receive payment now" />
        </Flex>
      }
      styles={{ body: on ? undefined : { display: "none" } }}
    >
      {on && (
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item
              label="Into account"
              name={["payment", "moneyAccountId"]}
              rules={[{ required: true, message: "Choose the account" }]}
            >
              <Select options={accounts} placeholder="Cash, bank, bKash…" />
            </Form.Item>
          </Col>
          <Col xs={12} md={5}>
            <Form.Item
              label="Method"
              name={["payment", "paymentMethod"]}
              rules={[{ required: true, message: "Choose how" }]}
            >
              <Select
                options={[
                  { value: "CASH", label: "Cash" },
                  { value: "BANK", label: "Bank" },
                  { value: "MOBILE", label: "Mobile banking" },
                  { value: "CARD", label: "Card" },
                ]}
              />
            </Form.Item>
          </Col>
          <Col xs={12} md={5}>
            <Form.Item
              label="Payment amount"
              name={["payment", "amount"]}
              rules={[{ required: true, message: "Enter the amount" }]}
            >
              <MoneyInput placeholder="0.00" />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="Payment date" name={["payment", "date"]}>
              <DatePicker format="DD MMM YYYY" style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={12} md={8}>
            <Form.Item label="Payment reference" name={["payment", "reference"]}>
              <Input maxLength={80} placeholder="Transaction ID, slip no." />
            </Form.Item>
          </Col>
        </Row>
      )}
    </Card>
  );
}

/** Sticky bar at the bottom of an invoice form. */
export function InvoiceActionBar({
  summary,
  cancelHref,
  showDraft,
  pending,
  primaryLabel,
  onSubmit,
}: {
  summary: ReactNode;
  cancelHref: string;
  showDraft: boolean;
  pending: boolean;
  primaryLabel: string;
  onSubmit: (post: boolean, print?: boolean) => void;
}) {
  return (
    <div className="inv-actions">
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        {summary}
      </Typography.Text>
      <div style={{ flex: 1 }} />
      <Link href={cancelHref}>
        <Button>Cancel</Button>
      </Link>
      {showDraft && (
        <Button loading={pending} onClick={() => onSubmit(false)}>
          Save as draft
        </Button>
      )}
      <Button type="primary" ghost loading={pending} onClick={() => onSubmit(true, true)}>
        Post and print
      </Button>
      <Button type="primary" loading={pending} onClick={() => onSubmit(true)}>
        {primaryLabel}
      </Button>
    </div>
  );
}

/**
 * Opens the PDF tab straight away (inside the click, so it is not blocked as a
 * pop-up) and returns a function that points it at the saved invoice, or closes it.
 */
export function openPrintWindow(print: boolean) {
  const w = print ? window.open("about:blank", "_blank") : null;
  return {
    show: (invoiceId: string) => {
      if (w) w.location.href = `/api/pdf/invoice/${invoiceId}`;
    },
    cancel: () => w?.close(),
  };
}

export { money as formatMaybeMoney };
