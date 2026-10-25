"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Col, Dropdown, Flex, Input, Row, Segmented, Tooltip, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { EllipsisOutlined, PlusOutlined } from "@ant-design/icons";
import { d } from "@/lib/calc/money";
import { formatDate, formatMoney } from "@/lib/format";
import type { ListParams } from "@/lib/listParams";
import type { InvoiceListRow } from "@/server/services/invoices/invoiceCommon";
import { DataTable } from "@/components/DataTable";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { PageHeader } from "@/components/PageHeader";
import { THEME } from "@/components/Providers";
import { StatusTag } from "@/components/StatusTag";
import { useUrlParams } from "@/components/useUrlParams";

interface Props {
  title: string;
  basePath: string;
  data: {
    rows: InvoiceListRow[];
    total: number;
    totals: { net: string; paid: string; refunded: string; due: string; profit: string };
    statusCounts: Record<string, number>;
  };
  params: ListParams;
  status?: string;
  canCreate: boolean;
  canEdit?: boolean;
  canReceive?: boolean;
}

function SummaryCard({
  label,
  value,
  note,
  color,
}: {
  label: string;
  value: string;
  note?: string;
  color?: string;
}) {
  return (
    <Card size="small" styles={{ body: { padding: "14px 16px" } }} style={{ height: "100%" }}>
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        {label}
      </Typography.Text>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color,
          margin: "4px 0 2px",
        }}
      >
        {value}
      </div>
      {note && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {note}
        </Typography.Text>
      )}
    </Card>
  );
}

/** Invoice list shared by invoice types (server side paging and filters). */
export function InvoiceList({
  title,
  basePath,
  data,
  params,
  status,
  canCreate,
  canEdit = false,
  canReceive = false,
}: Props) {
  const { setParams } = useUrlParams();
  const [search, setSearch] = useState(params.q);
  const c = data.statusCounts;
  const n = (k: string) => c[k] ?? 0;
  const all = Object.values(c).reduce((a, b) => a + b, 0);
  const net = d(data.totals.net);
  const collected = net.greaterThan(0)
    ? `${d(data.totals.paid).div(net).times(100).toFixed(0)}% collected`
    : undefined;
  const margin = net.greaterThan(0)
    ? `${d(data.totals.profit).div(net).times(100).toFixed(1)}% margin`
    : undefined;

  const columns: TableColumnsType<InvoiceListRow> = [
    {
      title: "Invoice",
      dataIndex: "number",
      key: "number",
      render: (v: string, r) => (
        <>
          <Link href={`${basePath}/${r.id}`} style={{ fontWeight: 600 }}>
            {v}
          </Link>
          <div style={{ fontSize: 12, color: THEME.muted }}>{formatDate(r.date)}</div>
        </>
      ),
    },
    {
      title: "Client",
      key: "client",
      render: (_, r) => (
        <>
          <Link href={`/clients/${r.clientId}`}>{r.clientName}</Link>
          <div style={{ fontSize: 12, color: THEME.muted }}>
            {[r.clientCode, r.clientPhone].filter(Boolean).join(" · ")}
          </div>
        </>
      ),
    },
    {
      title: "Passengers",
      key: "pax",
      render: (_, r) => {
        if (!r.passengers.length) return <Typography.Text type="secondary">-</Typography.Text>;
        const more = r.lineCount - 1;
        return (
          <Tooltip title={r.passengers.join(", ")}>
            <span>
              {r.passengers[0]}
              {more > 0 && (
                <div style={{ fontSize: 12, color: THEME.muted }}>
                  +{more} more
                </div>
              )}
            </span>
          </Tooltip>
        );
      },
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
      render: (v: string) =>
        v === "0.00" ? (
          <Typography.Text type="secondary">-</Typography.Text>
        ) : (
          <Typography.Text type="danger" strong>
            {formatMoney(v)}
          </Typography.Text>
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (s: string) => <StatusTag status={s} />,
    },
    {
      title: "Sold by",
      dataIndex: "soldBy",
      key: "soldBy",
      responsive: ["xl"],
      render: (v: string | null) => v ?? <Typography.Text type="secondary">-</Typography.Text>,
    },
    {
      title: "",
      key: "actions",
      align: "right",
      width: 150,
      render: (_, r) => {
        const live = r.status !== "VOID" && r.status !== "DRAFT";
        return (
          <Flex gap={6} justify="flex-end">
            {canReceive && live && r.due !== "0.00" ? (
              <Link href={`/moneyreceipts/new?client=${r.clientId}`}>
                <Button size="small" type="primary" ghost>
                  Receive
                </Button>
              </Link>
            ) : (
              <Link href={`${basePath}/${r.id}`}>
                <Button size="small">View</Button>
              </Link>
            )}
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  { key: "view", label: <Link href={`${basePath}/${r.id}`}>View</Link> },
                  ...(canEdit && r.status !== "VOID"
                    ? [{ key: "edit", label: <Link href={`${basePath}/${r.id}/edit`}>Edit</Link> }]
                    : []),
                  ...(live
                    ? [
                        {
                          key: "pdf",
                          label: (
                            <a href={`/api/pdf/invoice/${r.id}`} target="_blank" rel="noreferrer">
                              Print / PDF
                            </a>
                          ),
                        },
                      ]
                    : []),
                  {
                    key: "client",
                    label: <Link href={`/clients/${r.clientId}`}>Client ledger</Link>,
                  },
                ],
              }}
            >
              <Button size="small" icon={<EllipsisOutlined />} aria-label={`More for ${r.number}`} />
            </Dropdown>
          </Flex>
        );
      },
    },
  ];

  const tabs = [
    { value: "", label: `All ${all}` },
    { value: "DUE", label: `Due ${n("POSTED") + n("PARTIAL")}` },
    { value: "PARTIAL", label: `Partly paid ${n("PARTIAL")}` },
    { value: "PAID", label: `Paid ${n("PAID")}` },
    { value: "DRAFT", label: `Draft ${n("DRAFT")}` },
    { value: "VOID", label: `Void ${n("VOID")}` },
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
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} lg={6}>
          <SummaryCard
            label="Invoiced (excl. drafts & void)"
            value={formatMoney(data.totals.net)}
            note={`${all - n("DRAFT") - n("VOID")} invoice${all - n("DRAFT") - n("VOID") === 1 ? "" : "s"}`}
          />
        </Col>
        <Col xs={12} lg={6}>
          <SummaryCard
            label="Received"
            value={formatMoney(data.totals.paid)}
            note={collected}
            color={THEME.success}
          />
        </Col>
        <Col xs={12} lg={6}>
          <SummaryCard
            label="Due"
            value={formatMoney(data.totals.due)}
            note={`${n("POSTED") + n("PARTIAL")} with a balance`}
            color={THEME.danger}
          />
        </Col>
        <Col xs={12} lg={6}>
          <SummaryCard
            label={data.totals.refunded !== "0.00" ? "Profit · refunds deducted" : "Profit"}
            value={formatMoney(data.totals.profit)}
            note={margin}
          />
        </Col>
      </Row>
      <Card styles={{ body: { padding: 0 } }}>
        <Flex
          gap={8}
          wrap
          align="center"
          style={{ padding: "14px 16px", borderBottom: `1px solid ${THEME.line}` }}
        >
          <Segmented
            value={status ?? ""}
            onChange={(v) => setParams({ invoiceStatus: v ? String(v) : null })}
            options={tabs}
          />
          <div style={{ flex: 1 }} />
          <DateRangeFilter from={params.from} to={params.to} />
          <Input.Search
            allowClear
            placeholder="Invoice, client, ticket no., PNR or passenger"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(q) => setParams({ q })}
            style={{ width: 320 }}
          />
        </Flex>
        <div style={{ padding: "0 4px" }}>
          <DataTable<InvoiceListRow>
            rows={data.rows}
            total={data.total}
            page={params.page}
            pageSize={params.pageSize}
            columns={columns}
          />
        </div>
      </Card>
    </>
  );
}
