"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Flex, Input, Statistic } from "antd";
import type { TableColumnsType } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { formatDate, formatMoney } from "@/lib/format";
import { invoiceHref } from "@/lib/invoiceTypes";
import type { ListParams } from "@/lib/listParams";
import { REFUND_METHOD_LABEL, REFUND_TYPE_INFO, type RefundTypeKey } from "@/lib/refundTypes";
import type { RefundList as Data, RefundListRow } from "@/server/services/refund/postRefund";
import { DataTable } from "@/components/DataTable";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { PageHeader } from "@/components/PageHeader";
import { DocumentStatusTag } from "@/components/StatusTag";
import { useUrlParams } from "@/components/useUrlParams";

interface Props {
  type: RefundTypeKey;
  data: Data;
  params: ListParams;
  canCreate: boolean;
}

/** Refund history for one refund type (server side paging and filters). */
export function RefundList({ type, data, params, canCreate }: Props) {
  const info = REFUND_TYPE_INFO[type];
  const { setParams } = useUrlParams();
  const [search, setSearch] = useState(params.q);
  const money = (v: string) => formatMoney(v);

  const columns: TableColumnsType<RefundListRow> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 115,
      render: (v: string) => formatDate(v),
    },
    {
      title: "Refund",
      dataIndex: "number",
      key: "number",
      render: (v: string, r) => <Link href={`${info.path}/${r.id}`}>{v}</Link>,
    },
    {
      title: "Invoice",
      key: "invoice",
      render: (_, r) => (
        <Link href={invoiceHref(r.invoiceType, r.invoiceId) ?? "#"}>{r.invoiceNumber}</Link>
      ),
    },
    {
      title: "Client",
      key: "client",
      render: (_, r) => <Link href={`/clients/${r.clientId}`}>{r.clientName}</Link>,
    },
    {
      title: "Refunded",
      dataIndex: "clientRefundAmount",
      key: "refunded",
      align: "right",
      render: money,
    },
    { title: "Charge", dataIndex: "clientCharge", key: "charge", align: "right", render: money },
    {
      title: "Credit to client",
      dataIndex: "clientCredit",
      key: "credit",
      align: "right",
      render: money,
    },
    {
      title: "Back from vendor",
      dataIndex: "vendorCredit",
      key: "vendor",
      align: "right",
      render: money,
    },
    {
      title: "Method",
      key: "method",
      render: (_, r) =>
        r.method === "CASH_RETURN"
          ? `${REFUND_METHOD_LABEL.CASH_RETURN} ${formatMoney(r.returnAmount)}`
          : REFUND_METHOD_LABEL.ADJUST_TO_BALANCE,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v: string) => <DocumentStatusTag status={v} />,
    },
  ];

  return (
    <>
      <PageHeader
        title={`${info.label} Refunds`}
        extra={
          canCreate && (
            <Link href={`${info.path}/new`}>
              <Button type="primary" icon={<PlusOutlined />}>
                New refund
              </Button>
            </Link>
          )
        }
      />
      <Card style={{ marginBottom: 16 }}>
        <Flex gap={12} wrap>
          <Input.Search
            allowClear
            placeholder="Refund, invoice, client or passenger"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(v) => setParams({ q: v })}
            style={{ width: 320 }}
          />
          <DateRangeFilter from={params.from} to={params.to} />
        </Flex>
        <Flex gap={48} wrap style={{ marginTop: 16 }}>
          <Statistic title="Refunded (excl. void)" value={formatMoney(data.totals.refunded)} />
          <Statistic title="Charges kept" value={formatMoney(data.totals.clientCharge)} />
          <Statistic title="Credit to clients" value={formatMoney(data.totals.clientCredit)} />
          <Statistic title="Paid back" value={formatMoney(data.totals.paidBack)} />
          <Statistic title="Back from vendors" value={formatMoney(data.totals.vendorCredit)} />
        </Flex>
      </Card>
      <Card>
        <DataTable<RefundListRow>
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
