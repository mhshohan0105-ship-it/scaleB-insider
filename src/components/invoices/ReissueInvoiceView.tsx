"use client";

import Link from "next/link";
import { Card, Table, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { formatDate, formatMoney } from "@/lib/format";
import { invoiceHref } from "@/lib/invoiceTypes";
import type { ReissueInvoiceView as Invoice } from "@/server/services/invoices/reissueInvoiceService";
import { InvoiceShell, type ShellFlags, type WithRefunds } from "./InvoiceShell";

type Line = Invoice["lines"][number];

export function ReissueInvoiceView({
  invoice,
  ...flags
}: { invoice: WithRefunds<Invoice> } & ShellFlags) {
  const money = (v: string) => formatMoney(v);
  const columns: TableColumnsType<Line> = [
    {
      title: "Passenger",
      key: "pax",
      render: (_, l) => (
        <>
          {l.passengerName}
          <div style={{ fontSize: 12, color: "#888" }}>
            {l.airline} · {l.route}
          </div>
        </>
      ),
    },
    {
      title: "Original ticket",
      key: "orig",
      render: (_, l) => (
        <>
          {l.originalTicketNo}
          <div style={{ fontSize: 12 }}>
            <Link href={invoiceHref(l.originalInvoice.type, l.originalInvoice.id) ?? "#"}>
              {l.originalInvoice.number}
            </Link>{" "}
            · was {formatDate(l.originalJourneyDate)}
          </div>
        </>
      ),
    },
    {
      title: "New ticket / travel",
      key: "new",
      render: (_, l) => (
        <>
          {l.ticketNo ?? "-"}
          {l.pnr && <span style={{ color: "#888" }}> · PNR {l.pnr}</span>}
          <div style={{ fontSize: 12 }}>
            {formatDate(l.journeyDate)}
            {l.returnDate && ` → ${formatDate(l.returnDate)}`}
          </div>
        </>
      ),
    },
    { title: "Vendor", dataIndex: "vendor", key: "vendor" },
    { title: "Penalty", dataIndex: "penalty", key: "pen", align: "right", render: money },
    {
      title: "Fare diff.",
      dataIndex: "fareDifference",
      key: "fare",
      align: "right",
      render: money,
    },
    {
      title: "Service charge",
      dataIndex: "serviceCharge",
      key: "sc",
      align: "right",
      render: money,
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
      render: (v: string) => <Typography.Text type="success">{formatMoney(v)}</Typography.Text>,
    },
  ];

  return (
    <InvoiceShell invoice={invoice} {...flags}>
      <Card title={`Reissued tickets (${invoice.lines.length})`} style={{ marginBottom: 16 }}>
        <Table<Line>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={invoice.lines}
          pagination={false}
          scroll={{ x: "max-content" }}
        />
      </Card>
    </InvoiceShell>
  );
}
