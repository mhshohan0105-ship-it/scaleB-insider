"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Flex, Input, Select, Statistic, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { formatDate, formatMoney } from "@/lib/format";
import type { ListParams } from "@/lib/listParams";
import type { InvoiceListRow } from "@/server/services/invoices/invoiceCommon";
import { DataTable } from "@/components/DataTable";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { PageHeader } from "@/components/PageHeader";
import { StatusTag } from "@/components/StatusTag";
import { useUrlParams } from "@/components/useUrlParams";

interface Props {
  title: string;
  basePath: string;
  data: {
    rows: InvoiceListRow[];
    total: number;
    totals: { net: string; paid: string; refunded: string; due: string };
  };
  params: ListParams;
  status?: string;
  canCreate: boolean;
}

/** Invoice list shared by invoice types (server side paging and filters). */
export function InvoiceList({ title, basePath, data, params, status, canCreate }: Props) {
  const { setParams } = useUrlParams();
  const [search, setSearch] = useState(params.q);

  const columns: TableColumnsType<InvoiceListRow> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 115,
      render: (d: string) => formatDate(d),
    },
    {
      title: "Invoice",
      dataIndex: "number",
      key: "number",
      render: (v: string, r) => <Link href={`${basePath}/${r.id}`}>{v}</Link>,
    },
    {
      title: "Client",
      key: "client",
      render: (_, r) => (
        <>
          <Link href={`/clients/${r.clientId}`}>{r.clientName}</Link>
          <div style={{ fontSize: 12, color: "#888" }}>{r.clientCode}</div>
        </>
      ),
    },
    { title: "Items", dataIndex: "lineCount", key: "count", align: "center", width: 70 },
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
      render: (v: string) =>
        v === "0.00" ? "-" : <Typography.Text type="danger">{formatMoney(v)}</Typography.Text>,
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
      <PageHeader
        title={title}
        extra={
          canCreate && (
            <Link href={`${basePath}/new`}>
              <Button type="primary" icon={<PlusOutlined />}>
                New Invoice
              </Button>
            </Link>
          )
        }
      />
      <Card style={{ marginBottom: 16 }}>
        <Flex gap={8} wrap>
          <Input.Search
            allowClear
            placeholder="Invoice, client, ticket no., PNR or passenger"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(q) => setParams({ q })}
            style={{ width: 340 }}
          />
          <DateRangeFilter from={params.from} to={params.to} />
          <Select
            allowClear
            placeholder="Any status"
            style={{ width: 160 }}
            value={status}
            onChange={(v) => setParams({ invoiceStatus: v ?? null })}
            options={[
              { value: "DUE", label: "Has due" },
              { value: "DRAFT", label: "Draft" },
              { value: "POSTED", label: "Unpaid" },
              { value: "PARTIAL", label: "Partly paid" },
              { value: "PAID", label: "Paid" },
              { value: "VOID", label: "Void" },
            ]}
          />
        </Flex>
        <Flex gap={48} wrap style={{ marginTop: 16 }}>
          <Statistic
            title="Invoiced (filtered, excl. drafts & void)"
            value={formatMoney(data.totals.net)}
          />
          <Statistic title="Received" value={formatMoney(data.totals.paid)} />
          {data.totals.refunded !== "0.00" && (
            <Statistic title="Refunded" value={formatMoney(data.totals.refunded)} />
          )}
          <Statistic
            title="Due"
            value={formatMoney(data.totals.due)}
            valueStyle={{ color: "#cf1322" }}
          />
        </Flex>
      </Card>
      <Card>
        <DataTable<InvoiceListRow>
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
