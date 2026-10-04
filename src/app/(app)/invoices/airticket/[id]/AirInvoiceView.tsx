"use client";

import { Card, Table, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { formatDate, formatMoney } from "@/lib/format";
import type { AirInvoiceView as Invoice } from "@/server/services/invoices/airInvoiceService";
import {
  InvoiceShell,
  type ShellFlags,
  type WithRefunds,
} from "@/components/invoices/InvoiceShell";

type TicketRow = Invoice["tickets"][number];

type Props = { invoice: WithRefunds<Invoice> } & ShellFlags;

export function AirInvoiceView({ invoice, ...flags }: Props) {
  const nonCommission = invoice.type === "NON_COMMISSION";
  const columns: TableColumnsType<TicketRow> = [
    {
      title: "Ticket / PNR",
      key: "ticket",
      render: (_, t) => (
        <>
          <strong>{t.ticketNo}</strong>
          {t.pnr && <div style={{ fontSize: 12, color: "#888" }}>PNR {t.pnr}</div>}
        </>
      ),
    },
    {
      title: "Passenger",
      key: "pax",
      render: (_, t) => (
        <>
          {t.passengerName} <Typography.Text type="secondary">({t.passengerType})</Typography.Text>
          {t.passportNo && <div style={{ fontSize: 12, color: "#888" }}>{t.passportNo}</div>}
        </>
      ),
    },
    {
      title: "Flight",
      key: "flight",
      render: (_, t) => (
        <>
          {t.route} · {t.airline.split(" · ")[0]}
          <div style={{ fontSize: 12, color: "#888" }}>
            {formatDate(t.journeyDate)}
            {t.returnDate && ` → ${formatDate(t.returnDate)}`}
          </div>
        </>
      ),
    },
    { title: "Vendor", dataIndex: "vendor", key: "vendor" },
    {
      title: "Fare",
      key: "fare",
      align: "right",
      render: (_, t) => (
        <>
          {formatMoney(t.totalFare)}
          <div style={{ fontSize: 12, color: "#888" }}>
            {formatMoney(t.baseFare)} + {formatMoney(t.taxTotal)} tax
          </div>
        </>
      ),
    },
    {
      title: "Comm. / AIT",
      key: "comm",
      align: "right",
      render: (_, t) => (
        <>
          {formatMoney(t.commissionAmount)}{" "}
          <Typography.Text type="secondary">({t.commissionPercent}%)</Typography.Text>
          <div style={{ fontSize: 12, color: "#888" }}>AIT {formatMoney(t.aitAmount)}</div>
        </>
      ),
    },
    {
      title: "Purchase",
      dataIndex: "purchasePrice",
      key: "cost",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
    {
      title: "Client price",
      dataIndex: "clientPrice",
      key: "price",
      align: "right",
      render: (v: string) => <strong>{formatMoney(v)}</strong>,
    },
    {
      title: "Profit",
      dataIndex: "profit",
      key: "profit",
      align: "right",
      render: (v: string) => (
        <Typography.Text type={v.startsWith("-") ? "danger" : "success"}>
          {formatMoney(v)}
        </Typography.Text>
      ),
    },
  ];

  return (
    <InvoiceShell invoice={invoice} {...flags}>
      <Card title={`Tickets (${invoice.tickets.length})`} style={{ marginBottom: 16 }}>
        <Table<TicketRow>
          rowKey="id"
          size="small"
          columns={nonCommission ? columns.filter((c) => c.key !== "comm") : columns}
          dataSource={invoice.tickets}
          pagination={false}
          scroll={{ x: "max-content" }}
        />
      </Card>
    </InvoiceShell>
  );
}
