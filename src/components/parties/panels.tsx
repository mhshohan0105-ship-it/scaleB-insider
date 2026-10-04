"use client";

// Data tabs on party profile pages. Each panel receives server-loaded data;
// paging and date filters live in the URL.
import Link from "next/link";
import { Descriptions, Flex, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { formatDate, formatMoney } from "@/lib/format";
import type { ListParams } from "@/lib/listParams";
import { SOURCE_LABELS, sourceHref } from "@/lib/sourceLinks";
import type { InvoiceListRow, VendorPurchaseRow } from "@/server/services/invoices/invoiceCommon";
import { INVOICE_TYPE_INFO, invoiceHref, type InvoiceTypeKey } from "@/lib/invoiceTypes";
import type { LedgerLine, PartyLedger } from "@/server/services/ledger/partyLedger";
import type { ReceiptRow } from "@/server/services/payments/receiptService";
import type { VendorPaymentRow } from "@/server/services/payments/vendorPaymentService";
import type { VoucherList, VoucherRow } from "@/server/services/vouchers/voucherService";
import { DataTable } from "@/components/DataTable";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { DocumentStatusTag, StatusTag } from "@/components/StatusTag";

const signed = (v: string, due = "Dr", adv = "Cr") => {
  if (v === "0.00") return "0.00";
  return v.startsWith("-") ? `${formatMoney(v.slice(1))} ${adv}` : `${formatMoney(v)} ${due}`;
};

const SIDE_LABEL: Record<string, string> = {
  CLIENT: "Client a/c",
  VENDOR: "Vendor a/c",
  COMBINED: "Own",
};

export function LedgerPanel({
  ledger,
  params,
  showSide,
}: {
  ledger: PartyLedger;
  params: ListParams;
  /** Combined clients: which account (client / vendor / own) each line is on. */
  showSide?: boolean;
}) {
  const columns: TableColumnsType<LedgerLine> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 115,
      render: (v: string) => formatDate(v),
    },
    {
      title: "Details",
      key: "details",
      render: (_, r) => {
        const href = sourceHref(r.sourceType, r.sourceId);
        return (
          <>
            {href ? <Link href={href}>{r.narration}</Link> : r.narration}
            <div>
              {showSide && (
                <Tag color={r.side === "VENDOR" ? "orange" : "blue"} style={{ marginTop: 4 }}>
                  {SIDE_LABEL[r.side] ?? r.side}
                </Tag>
              )}
              <Tag style={{ marginTop: 4 }}>{SOURCE_LABELS[r.sourceType] ?? r.sourceType}</Tag>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {r.number}
              </Typography.Text>
            </div>
          </>
        );
      },
    },
    {
      title: "Debit",
      dataIndex: "debit",
      key: "debit",
      align: "right",
      render: (v: string) => (v === "0.00" ? "" : formatMoney(v)),
    },
    {
      title: "Credit",
      dataIndex: "credit",
      key: "credit",
      align: "right",
      render: (v: string) => (v === "0.00" ? "" : formatMoney(v)),
    },
    {
      title: "Balance",
      dataIndex: "balance",
      key: "balance",
      align: "right",
      render: (v: string) => <Typography.Text strong>{signed(v)}</Typography.Text>,
    },
  ];
  return (
    <>
      <Flex justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <DateRangeFilter from={params.from} to={params.to} />
        <Descriptions
          size="small"
          column={4}
          items={[
            { key: "o", label: "Opening", children: signed(ledger.opening) },
            { key: "d", label: "Debits", children: formatMoney(ledger.totalDebit) },
            { key: "c", label: "Credits", children: formatMoney(ledger.totalCredit) },
            { key: "cl", label: "Closing", children: <strong>{signed(ledger.closing)}</strong> },
          ]}
        />
      </Flex>
      <DataTable<LedgerLine>
        rows={ledger.rows}
        total={ledger.total}
        page={params.page}
        pageSize={params.pageSize}
        columns={columns}
      />
      <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
        Dr = they owe you, Cr = you owe them (advance / payable).
      </Typography.Paragraph>
    </>
  );
}

export function InvoicesPanel({
  data,
  params,
}: {
  data: {
    rows: InvoiceListRow[];
    total: number;
    totals: { net: string; paid: string; refunded: string; due: string };
  };
  params: ListParams;
}) {
  const columns: TableColumnsType<InvoiceListRow> = [
    { title: "Date", dataIndex: "date", key: "date", render: (v: string) => formatDate(v) },
    {
      title: "Invoice",
      dataIndex: "number",
      key: "number",
      render: (v: string, r) => (
        <>
          <Link href={invoiceHref(r.type, r.id) ?? "#"}>{v}</Link>
          <div style={{ fontSize: 12, color: "#888" }}>
            {INVOICE_TYPE_INFO[r.type as InvoiceTypeKey]?.label ?? r.type}
          </div>
        </>
      ),
    },
    {
      title: "Total",
      dataIndex: "netTotal",
      key: "net",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
    {
      title: "Received",
      dataIndex: "paidAmount",
      key: "paid",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
    {
      title: "Due",
      dataIndex: "due",
      key: "due",
      align: "right",
      render: (v: string) => (v === "0.00" ? "-" : formatMoney(v)),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (s: string) => <StatusTag status={s} />,
    },
  ];
  return (
    <>
      <Flex justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <DateRangeFilter from={params.from} to={params.to} />
        <Typography.Text>
          Due on invoices: <strong>{formatMoney(data.totals.due)}</strong>
        </Typography.Text>
      </Flex>
      <DataTable<InvoiceListRow>
        rows={data.rows}
        total={data.total}
        page={params.page}
        pageSize={params.pageSize}
        columns={columns}
      />
    </>
  );
}

export function ReceiptsPanel({
  data,
  params,
}: {
  data: { rows: ReceiptRow[]; total: number; totalAmount: string };
  params: ListParams;
}) {
  const columns: TableColumnsType<ReceiptRow> = [
    { title: "Date", dataIndex: "date", key: "date", render: (v: string) => formatDate(v) },
    {
      title: "Receipt",
      dataIndex: "number",
      key: "number",
      render: (v: string, r) => <Link href={`/moneyreceipts/${r.id}`}>{v}</Link>,
    },
    { title: "Into", dataIndex: "account", key: "account" },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (s: string) => <DocumentStatusTag status={s} />,
    },
  ];
  return (
    <>
      <Flex justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <DateRangeFilter from={params.from} to={params.to} />
        <Typography.Text>
          Received: <strong>{formatMoney(data.totalAmount)}</strong>
        </Typography.Text>
      </Flex>
      <DataTable<ReceiptRow>
        rows={data.rows}
        total={data.total}
        page={params.page}
        pageSize={params.pageSize}
        columns={columns}
      />
    </>
  );
}

export function PurchasesPanel({
  data,
  params,
}: {
  data: { rows: VendorPurchaseRow[]; total: number; totalCost: string };
  params: ListParams;
}) {
  const columns: TableColumnsType<VendorPurchaseRow> = [
    { title: "Date", dataIndex: "date", key: "date", render: (v: string) => formatDate(v) },
    {
      title: "Invoice",
      key: "invoice",
      render: (_, r) => {
        const href = invoiceHref(r.invoiceType, r.invoiceId);
        return (
          <>
            {href ? <Link href={href}>{r.invoiceNumber}</Link> : r.invoiceNumber}
            <div style={{ fontSize: 12, color: "#888" }}>
              {INVOICE_TYPE_INFO[r.invoiceType as InvoiceTypeKey]?.label ?? r.invoiceType}
            </div>
          </>
        );
      },
    },
    {
      title: "What",
      key: "what",
      render: (_, r) => (
        <>
          {r.description}
          {r.detail && <div style={{ fontSize: 12, color: "#888" }}>{r.detail}</div>}
        </>
      ),
    },
    {
      title: "Cost",
      dataIndex: "cost",
      key: "cost",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
  ];
  return (
    <>
      <Flex justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <DateRangeFilter from={params.from} to={params.to} />
        <Typography.Text>
          Purchased: <strong>{formatMoney(data.totalCost)}</strong>
        </Typography.Text>
      </Flex>
      <DataTable<VendorPurchaseRow>
        rows={data.rows}
        total={data.total}
        page={params.page}
        pageSize={params.pageSize}
        columns={columns}
      />
    </>
  );
}

/** Commission paid to an agent (Agent Payment vouchers). */
export function AgentPaymentsPanel({ data, params }: { data: VoucherList; params: ListParams }) {
  const columns: TableColumnsType<VoucherRow> = [
    { title: "Date", dataIndex: "date", key: "date", render: (v: string) => formatDate(v) },
    { title: "No.", dataIndex: "number", key: "number" },
    { title: "From", dataIndex: "moneyAccount", key: "account" },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
    {
      title: "Status",
      key: "status",
      render: (_, r) => <DocumentStatusTag status={r.status} reason={r.voidReason} />,
    },
  ];
  return (
    <>
      <Flex justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <DateRangeFilter from={params.from} to={params.to} />
        <Typography.Text>
          Paid: <strong>{formatMoney(data.totals.amount)}</strong>
        </Typography.Text>
      </Flex>
      <DataTable<VoucherRow>
        rows={data.rows}
        total={data.total}
        page={params.page}
        pageSize={params.pageSize}
        columns={columns}
      />
    </>
  );
}

export function VendorPaymentsPanel({
  data,
  params,
}: {
  data: { rows: VendorPaymentRow[]; total: number; totalAmount: string };
  params: ListParams;
}) {
  const columns: TableColumnsType<VendorPaymentRow> = [
    { title: "Date", dataIndex: "date", key: "date", render: (v: string) => formatDate(v) },
    { title: "No.", dataIndex: "number", key: "number" },
    { title: "From", dataIndex: "account", key: "account" },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
    {
      title: "Status",
      key: "status",
      render: (_, r) => <DocumentStatusTag status={r.status} reason={r.voidReason} />,
    },
  ];
  return (
    <>
      <Flex justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <DateRangeFilter from={params.from} to={params.to} />
        <Typography.Text>
          Paid: <strong>{formatMoney(data.totalAmount)}</strong>
        </Typography.Text>
      </Flex>
      <DataTable<VendorPaymentRow>
        rows={data.rows}
        total={data.total}
        page={params.page}
        pageSize={params.pageSize}
        columns={columns}
      />
    </>
  );
}
