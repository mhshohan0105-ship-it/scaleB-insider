"use client";

import { useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Flex,
  Popconfirm,
  Row,
  Space,
  Table,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  DollarOutlined,
  EditOutlined,
  PrinterOutlined,
  RollbackOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { amountInWords } from "@/lib/amountInWords";
import { formatDate, formatMoney } from "@/lib/format";
import { INVOICE_TYPE_INFO, type InvoiceTypeKey } from "@/lib/invoiceTypes";
import { REFUND_TYPE_INFO, refundTypeFor, type RefundTypeKey } from "@/lib/refundTypes";
import { DocumentStatusTag, StatusTag } from "@/components/StatusTag";
import { VoidButton } from "@/components/VoidButton";
import { applyActionResult } from "@/components/formResult";
import { postInvoiceAction, voidInvoiceAction } from "@/app/(app)/invoices/invoiceActions";

/** Header fields every invoice view has. */
export interface InvoiceSummary {
  id: string;
  type: string;
  number: string;
  status: string;
  date: string;
  dueDate: string | null;
  client: { id: string; name: string; code: string };
  agent: { name: string } | null;
  salesman: { name: string } | null;
  subtotal: string;
  discount: string;
  serviceCharge: string;
  vat: string;
  netTotal: string;
  totalCost: string;
  agentCommission: string;
  profit: string;
  paidAmount: string;
  /** Client credit from live refunds. */
  refundCredit: string;
  due: string;
  note: string | null;
  voidReason: string | null;
  payments: { receiptId: string; number: string; date: string; amount: string }[];
  /** Refunds of this invoice (live and void), added by the page. */
  refunds?: {
    id: string;
    number: string;
    type: string;
    date: string;
    status: string;
    clientCredit: string;
  }[];
}

/** A service invoice view plus the refunds the page adds. */
export type WithRefunds<T> = T & Pick<InvoiceSummary, "refunds">;

/** What the signed-in user may do on an invoice page. */
export interface ShellFlags {
  canEdit: boolean;
  canVoid: boolean;
  canReceive: boolean;
  canRefund?: boolean;
}

interface Props extends ShellFlags {
  invoice: InvoiceSummary;
  /** Extra header lines (tour group, travel dates, ...). */
  details?: ReactNode;
  /** The invoice's own lines. */
  children: ReactNode;
}

export function InvoiceShell({
  invoice,
  canEdit,
  canVoid,
  canReceive,
  canRefund,
  details,
  children,
}: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const [posting, startPosting] = useTransition();
  const info = INVOICE_TYPE_INFO[invoice.type as InvoiceTypeKey];
  const live = invoice.status !== "VOID" && invoice.status !== "REFUNDED";
  const hasDue = invoice.status !== "DRAFT" && invoice.status !== "VOID" && invoice.due !== "0.00";
  const nonZero = (v: string) => v !== "0.00";
  const liveRefunds = (invoice.refunds ?? []).filter((r) => r.status === "POSTED");
  const refundable =
    invoice.status === "POSTED" || invoice.status === "PARTIAL" || invoice.status === "PAID";
  const refundPath = REFUND_TYPE_INFO[refundTypeFor(invoice.type as InvoiceTypeKey)].path;

  return (
    <>
      <Link href={info.path} style={{ display: "inline-block", marginBottom: 12 }}>
        <ArrowLeftOutlined /> {info.label} invoices
      </Link>

      <Card style={{ marginBottom: 16 }}>
        <Flex justify="space-between" align="flex-start" wrap gap={16}>
          <Space direction="vertical" size={2}>
            <Space>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {invoice.number}
              </Typography.Title>
              <StatusTag status={invoice.status} />
            </Space>
            <Typography.Text>
              <Link href={`/clients/${invoice.client.id}`}>{invoice.client.name}</Link>{" "}
              <Typography.Text type="secondary">({invoice.client.code})</Typography.Text>
            </Typography.Text>
            <Typography.Text type="secondary">
              {formatDate(invoice.date)}
              {invoice.dueDate && ` · due ${formatDate(invoice.dueDate)}`}
              {invoice.salesman && ` · sold by ${invoice.salesman.name}`}
            </Typography.Text>
            {details}
          </Space>
          <Space wrap>
            {invoice.status !== "DRAFT" && (
              <Button
                icon={<PrinterOutlined />}
                href={`/api/pdf/invoice/${invoice.id}`}
                target="_blank"
              >
                Print / PDF
              </Button>
            )}
            {canReceive && hasDue && (
              <Link href={`/moneyreceipts/new?client=${invoice.client.id}`}>
                <Button type="primary" icon={<DollarOutlined />}>
                  Receive payment
                </Button>
              </Link>
            )}
            {canEdit && invoice.status === "DRAFT" && (
              <Popconfirm
                title="Post this invoice?"
                description="It will be recorded in the client's and vendors' ledgers."
                onConfirm={() =>
                  startPosting(async () => {
                    const r = await postInvoiceAction(invoice.type, invoice.id);
                    if (applyActionResult(r, null, message, "Invoice posted")) router.refresh();
                  })
                }
              >
                <Button type="primary" icon={<SendOutlined />} loading={posting}>
                  Post
                </Button>
              </Popconfirm>
            )}
            {canRefund && refundable && (
              <Link href={`${refundPath}/new?invoice=${invoice.id}`}>
                <Button icon={<RollbackOutlined />}>Refund</Button>
              </Link>
            )}
            {canEdit && live && liveRefunds.length === 0 && (
              <Link href={`${info.path}/${invoice.id}/edit`}>
                <Button icon={<EditOutlined />}>Edit</Button>
              </Link>
            )}
            {canVoid && live && (
              <VoidButton
                what={`invoice ${invoice.number}`}
                description={
                  liveRefunds.length
                    ? "This invoice has refunds. Void them first."
                    : nonZero(invoice.paidAmount)
                      ? "Money has been received against this invoice. Void those receipts first."
                      : undefined
                }
                onVoid={(v) => voidInvoiceAction(invoice.type, invoice.id, v)}
              />
            )}
          </Space>
        </Flex>
        {invoice.status === "VOID" && (
          <Alert
            style={{ marginTop: 16 }}
            type="error"
            showIcon
            message={`Void: ${invoice.voidReason ?? ""}`}
          />
        )}
        {invoice.status === "DRAFT" && (
          <Alert
            style={{ marginTop: 16 }}
            type="info"
            showIcon
            message="Draft: nothing is in the ledgers until you post it."
          />
        )}
      </Card>

      {children}

      {(invoice.refunds ?? []).length > 0 && (
        <Card title="Refunds" style={{ marginBottom: 16 }}>
          <Table<NonNullable<InvoiceSummary["refunds"]>[number]>
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={invoice.refunds}
            columns={[
              { title: "Date", dataIndex: "date", render: (v: string) => formatDate(v) },
              {
                title: "Refund",
                dataIndex: "number",
                render: (v: string, r) => (
                  <Link href={`${REFUND_TYPE_INFO[r.type as RefundTypeKey].path}/${r.id}`}>
                    {v}
                  </Link>
                ),
              },
              {
                title: "Status",
                dataIndex: "status",
                render: (v: string) => <DocumentStatusTag status={v} />,
              },
              {
                title: "Credit to client",
                dataIndex: "clientCredit",
                align: "right",
                render: (v: string) => formatMoney(v),
              },
            ]}
          />
        </Card>
      )}

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="Payments" style={{ marginBottom: 16 }}>
            {invoice.payments.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing received yet" />
            ) : (
              <Table<InvoiceSummary["payments"][number]>
                rowKey="receiptId"
                size="small"
                pagination={false}
                dataSource={invoice.payments}
                columns={[
                  { title: "Date", dataIndex: "date", render: (v: string) => formatDate(v) },
                  {
                    title: "Receipt",
                    dataIndex: "number",
                    render: (v: string, r) => (
                      <Link href={`/moneyreceipts/${r.receiptId}`}>{v}</Link>
                    ),
                  },
                  {
                    title: "Amount",
                    dataIndex: "amount",
                    align: "right",
                    render: (v: string) => formatMoney(v),
                  },
                ]}
              />
            )}
            {invoice.note && (
              <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
                Note: {invoice.note}
              </Typography.Paragraph>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Totals" style={{ marginBottom: 16 }}>
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                { key: "sub", label: "Lines", children: formatMoney(invoice.subtotal) },
                ...(nonZero(invoice.discount)
                  ? [
                      {
                        key: "disc",
                        label: "Discount",
                        children: `- ${formatMoney(invoice.discount)}`,
                      },
                    ]
                  : []),
                ...(nonZero(invoice.serviceCharge)
                  ? [
                      {
                        key: "sc",
                        label: "Service charge",
                        children: formatMoney(invoice.serviceCharge),
                      },
                    ]
                  : []),
                ...(nonZero(invoice.vat)
                  ? [{ key: "vat", label: "VAT", children: formatMoney(invoice.vat) }]
                  : []),
                {
                  key: "net",
                  label: "Total",
                  children: <strong>{formatMoney(invoice.netTotal)}</strong>,
                },
                ...(nonZero(invoice.refundCredit)
                  ? [
                      {
                        key: "refund",
                        label: "Refunded to client",
                        children: `- ${formatMoney(invoice.refundCredit)}`,
                      },
                    ]
                  : []),
                { key: "paid", label: "Received", children: formatMoney(invoice.paidAmount) },
                {
                  key: "due",
                  label: "Due",
                  children: (
                    <Typography.Text strong type={nonZero(invoice.due) ? "danger" : undefined}>
                      {formatMoney(invoice.due)}
                    </Typography.Text>
                  ),
                },
                {
                  key: "cost",
                  label: "Payable to vendors",
                  children: formatMoney(invoice.totalCost),
                },
                ...(invoice.agent
                  ? [
                      {
                        key: "agent",
                        label: `Agent commission (${invoice.agent.name})`,
                        children: formatMoney(invoice.agentCommission),
                      },
                    ]
                  : []),
                { key: "profit", label: "Profit", children: formatMoney(invoice.profit) },
              ]}
            />
            <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
              {amountInWords(invoice.netTotal)}
            </Typography.Paragraph>
          </Card>
        </Col>
      </Row>
    </>
  );
}
