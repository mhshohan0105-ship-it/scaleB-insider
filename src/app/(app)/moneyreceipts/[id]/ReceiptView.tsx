"use client";

import Link from "next/link";
import { Alert, Button, Card, Descriptions, Flex, Space, Table, Typography } from "antd";
import { ArrowLeftOutlined, PrinterOutlined } from "@ant-design/icons";
import { amountInWords } from "@/lib/amountInWords";
import { formatDate, formatMoney } from "@/lib/format";
import { invoiceHref } from "@/lib/invoiceTypes";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/schemas/invoices";
import type { MoneyReceiptView } from "@/server/services/payments/receiptService";
import { DocumentStatusTag } from "@/components/StatusTag";
import { VoidButton } from "@/components/VoidButton";
import { voidMoneyReceiptAction } from "../actions";

const METHOD = Object.fromEntries(PAYMENT_METHOD_OPTIONS.map((o) => [o.value, o.label]));

export function ReceiptView({ receipt, canVoid }: { receipt: MoneyReceiptView; canVoid: boolean }) {
  return (
    <>
      <Link href="/moneyreceipts" style={{ display: "inline-block", marginBottom: 12 }}>
        <ArrowLeftOutlined /> Money receipts
      </Link>
      <Card style={{ marginBottom: 16 }}>
        <Flex justify="space-between" wrap gap={16}>
          <Space direction="vertical" size={2}>
            <Space>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {receipt.number}
              </Typography.Title>
              <DocumentStatusTag status={receipt.status} />
            </Space>
            <Typography.Text>
              From <Link href={`/clients/${receipt.client.id}`}>{receipt.client.name}</Link> on{" "}
              {formatDate(receipt.date)}
            </Typography.Text>
          </Space>
          <Space>
            <Button
              icon={<PrinterOutlined />}
              href={`/api/pdf/receipt/${receipt.id}`}
              target="_blank"
            >
              Print / PDF
            </Button>
            {canVoid && receipt.status === "POSTED" && (
              <VoidButton
                what={`receipt ${receipt.number}`}
                description="The money is taken back out of the account and the invoices it paid become due again."
                onVoid={(v) => voidMoneyReceiptAction(receipt.id, v)}
              />
            )}
          </Space>
        </Flex>
        {receipt.status === "VOID" && (
          <Alert
            style={{ marginTop: 16 }}
            type="error"
            showIcon
            message={`Void: ${receipt.voidReason ?? ""}`}
          />
        )}
      </Card>
      <Card style={{ marginBottom: 16 }}>
        <Descriptions
          bordered
          size="small"
          column={{ xs: 1, md: 2 }}
          items={[
            {
              key: "amount",
              label: "Amount",
              children: <strong>{formatMoney(receipt.amount)}</strong>,
            },
            { key: "words", label: "In words", children: amountInWords(receipt.amount) },
            { key: "account", label: "Into", children: receipt.account },
            {
              key: "method",
              label: "Method",
              children: METHOD[receipt.paymentMethod] ?? receipt.paymentMethod,
            },
            ...(receipt.transactionCharge !== "0.00"
              ? [
                  {
                    key: "charge",
                    label: "Transaction charge",
                    children: formatMoney(receipt.transactionCharge),
                  },
                ]
              : []),
            ...(receipt.reference
              ? [{ key: "ref", label: "Reference", children: receipt.reference }]
              : []),
            {
              key: "alloc",
              label: "Applied to invoices",
              children: formatMoney(receipt.allocated),
            },
            { key: "adv", label: "Kept as advance", children: formatMoney(receipt.advance) },
            ...(receipt.note ? [{ key: "note", label: "Note", children: receipt.note }] : []),
          ]}
        />
      </Card>
      <Card title="Invoices paid">
        <Table
          rowKey="invoiceId"
          size="small"
          pagination={false}
          dataSource={receipt.allocations}
          locale={{ emptyText: "Not applied to any invoice (all advance)" }}
          columns={[
            { title: "Date", dataIndex: "date", render: (v: string) => formatDate(v) },
            {
              title: "Invoice",
              dataIndex: "number",
              render: (v: string, r) =>
                invoiceHref(r.type, r.invoiceId) ? (
                  <Link href={invoiceHref(r.type, r.invoiceId)!}>{v}</Link>
                ) : (
                  v
                ),
            },
            {
              title: "Invoice total",
              dataIndex: "netTotal",
              align: "right",
              render: (v: string) => formatMoney(v),
            },
            {
              title: "Applied",
              dataIndex: "amount",
              align: "right",
              render: (v: string) => formatMoney(v),
            },
          ]}
        />
      </Card>
    </>
  );
}
