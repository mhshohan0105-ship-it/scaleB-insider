"use client";

import Link from "next/link";
import { Card, Table, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { formatDate, formatMoney } from "@/lib/format";
import type { ItemInvoiceView as Invoice } from "@/server/services/invoices/itemInvoiceService";
import { InvoiceShell, type ShellFlags, type WithRefunds } from "./InvoiceShell";

type Line = Invoice["items"][number];

const KIND_LABEL: Record<string, string> = {
  PACKAGE: "Package",
  ACCOMMODATION: "Accommodation",
  TRANSPORT: "Transport",
  OTHER_TRANSPORT: "Other transport",
  GUIDE: "Guide",
  FOOD: "Food",
  PLACE: "Sightseeing",
  TOUR_TICKET: "Tickets",
  SERVICE: "Service",
  PILGRIM: "Pilgrim",
};

export function ItemInvoiceView({
  invoice,
  ...flags
}: { invoice: WithRefunds<Invoice> } & ShellFlags) {
  const umrah = ["UMRAH", "HAJJ_PRE_REG", "HAJJ"].includes(invoice.type);
  const columns: TableColumnsType<Line> = [
    ...(umrah
      ? [
          {
            title: "Pilgrim",
            key: "pax",
            render: (_: unknown, l: Line) => (
              <>
                {l.pilgrimId ? (
                  <Link href={`/hajj/pilgrims/${l.pilgrimId}`}>{l.passengerName}</Link>
                ) : (
                  l.passengerName
                )}
                {l.passportNo && <div style={{ fontSize: 12, color: "#888" }}>{l.passportNo}</div>}
              </>
            ),
          },
          {
            title: "Room",
            dataIndex: "roomType",
            key: "room",
            render: (v: string | null) => v ?? "-",
          },
        ]
      : [
          {
            title: "Kind",
            dataIndex: "kind",
            key: "kind",
            render: (k: string) => KIND_LABEL[k] ?? k,
          },
        ]),
    {
      title: umrah ? "Package" : "Description",
      key: "desc",
      render: (_, l) => (
        <>
          {l.description}
          {l.product && <div style={{ fontSize: 12, color: "#888" }}>{l.product}</div>}
        </>
      ),
    },
    ...(umrah ? [] : [{ title: "Qty", dataIndex: "qty", key: "qty", align: "right" as const }]),
    { title: "Vendor", dataIndex: "vendor", key: "vendor", render: (v: string | null) => v ?? "-" },
    {
      title: "Cost",
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

  const details = (
    <>
      {invoice.tourGroup && (
        <Typography.Text type="secondary">Tour group: {invoice.tourGroup.name}</Typography.Text>
      )}
      {invoice.group && (
        <Typography.Text type="secondary">Group: {invoice.group.name}</Typography.Text>
      )}
      {invoice.travelDate && (
        <Typography.Text type="secondary">
          Travel {formatDate(invoice.travelDate)}
          {invoice.returnDate && ` → ${formatDate(invoice.returnDate)}`}
        </Typography.Text>
      )}
    </>
  );

  return (
    <InvoiceShell invoice={invoice} {...flags} details={details}>
      <Card
        title={`${umrah ? "Pilgrims" : "Lines"} (${invoice.items.length})`}
        style={{ marginBottom: 16 }}
      >
        <Table<Line>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={invoice.items}
          pagination={false}
          scroll={{ x: "max-content" }}
        />
      </Card>
    </InvoiceShell>
  );
}
