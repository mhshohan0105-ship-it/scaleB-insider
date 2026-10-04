"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Flex, Input, Statistic } from "antd";
import type { TableColumnsType } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { formatDate, formatMoney } from "@/lib/format";
import type { ListParams } from "@/lib/listParams";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/schemas/invoices";
import type { ReceiptRow } from "@/server/services/payments/receiptService";
import { DataTable } from "@/components/DataTable";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { PageHeader } from "@/components/PageHeader";
import { DocumentStatusTag } from "@/components/StatusTag";
import { useUrlParams } from "@/components/useUrlParams";

const METHOD = Object.fromEntries(
  PAYMENT_METHOD_OPTIONS.map((o) => [o.value, o.label.split(" (")[0]]),
);

export function ReceiptList({
  data,
  params,
  canCreate,
}: {
  data: { rows: ReceiptRow[]; total: number; totalAmount: string };
  params: ListParams;
  canCreate: boolean;
}) {
  const { setParams } = useUrlParams();
  const [search, setSearch] = useState(params.q);

  const columns: TableColumnsType<ReceiptRow> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 115,
      render: (d: string) => formatDate(d),
    },
    {
      title: "Receipt",
      dataIndex: "number",
      key: "number",
      render: (v: string, r) => <Link href={`/moneyreceipts/${r.id}`}>{v}</Link>,
    },
    {
      title: "Client",
      key: "client",
      render: (_, r) => <Link href={`/clients/${r.clientId}`}>{r.clientName}</Link>,
    },
    {
      title: "Into",
      key: "account",
      render: (_, r) => (
        <>
          {r.account}
          <div style={{ fontSize: 12, color: "#888" }}>
            {METHOD[r.paymentMethod] ?? r.paymentMethod}
          </div>
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
      title: "Advance",
      dataIndex: "advance",
      key: "advance",
      align: "right",
      render: (v: string) => (v === "0.00" ? "-" : formatMoney(v)),
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
      <PageHeader
        title="Money Receipts"
        extra={
          canCreate && (
            <Link href="/moneyreceipts/new">
              <Button type="primary" icon={<PlusOutlined />}>
                New Receipt
              </Button>
            </Link>
          )
        }
      />
      <Card style={{ marginBottom: 16 }}>
        <Flex gap={8} wrap align="center" justify="space-between">
          <Flex gap={8} wrap>
            <Input.Search
              allowClear
              placeholder="Receipt no., reference or client"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSearch={(q) => setParams({ q })}
              style={{ width: 300 }}
            />
            <DateRangeFilter from={params.from} to={params.to} />
          </Flex>
          <Statistic
            title="Received (filtered, excl. void)"
            value={formatMoney(data.totalAmount)}
          />
        </Flex>
      </Card>
      <Card>
        <DataTable<ReceiptRow>
          rows={data.rows}
          total={data.total}
          page={params.page}
          pageSize={params.pageSize}
          columns={columns}
        />
      </Card>
    </>
  );
}
