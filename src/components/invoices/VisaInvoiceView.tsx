"use client";

import { useRouter } from "next/navigation";
import { App, Button, Card, Popover, Space, Table, Tag, Timeline, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { VisaInvoiceView as Invoice } from "@/server/services/invoices/visaInvoiceService";
import { applyActionResult } from "@/components/formResult";
import { setVisaStatusAction } from "@/app/(app)/invoices/invoiceActions";
import { InvoiceShell, type ShellFlags, type WithRefunds } from "./InvoiceShell";
import { VISA_NEXT, VISA_STATUS_COLOR, VISA_STATUS_LABEL } from "./visaStatus";

type Line = Invoice["lines"][number];

/** Buttons that move a visa to its next status. */
export function VisaStatusButtons({
  lineId,
  status,
  onDone,
}: {
  lineId: string;
  status: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  return (
    <Space size={4} wrap>
      {(VISA_NEXT[status] ?? []).map((next) => (
        <Button
          key={next}
          size="small"
          danger={next === "REJECTED"}
          onClick={async () => {
            const r = await setVisaStatusAction(lineId, { status: next });
            if (
              applyActionResult(
                r,
                null,
                message,
                `Marked ${VISA_STATUS_LABEL[next]?.toLowerCase()}`,
              )
            ) {
              onDone?.();
              router.refresh();
            }
          }}
        >
          {VISA_STATUS_LABEL[next]}
        </Button>
      ))}
    </Space>
  );
}

export function VisaInvoiceView({
  invoice,
  ...flags
}: { invoice: WithRefunds<Invoice> } & ShellFlags) {
  const live = invoice.status !== "VOID" && invoice.status !== "DRAFT";
  const columns: TableColumnsType<Line> = [
    {
      title: "Passenger",
      key: "pax",
      render: (_, l) => (
        <>
          {l.passengerName}
          {l.passportNo && <div style={{ fontSize: 12, color: "#888" }}>{l.passportNo}</div>}
        </>
      ),
    },
    {
      title: "Visa",
      key: "visa",
      render: (_, l) => (
        <>
          {l.country}
          {l.visaType && <div style={{ fontSize: 12, color: "#888" }}>{l.visaType}</div>}
        </>
      ),
    },
    { title: "Vendor", dataIndex: "vendor", key: "vendor" },
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
      title: "Status",
      key: "status",
      render: (_, l) => (
        <Space direction="vertical" size={4}>
          <Popover
            title="History"
            content={
              <Timeline
                style={{ marginTop: 8, marginBottom: -24 }}
                items={l.history.map((h) => ({
                  color: VISA_STATUS_COLOR[h.status] === "error" ? "red" : "green",
                  children: (
                    <>
                      {VISA_STATUS_LABEL[h.status] ?? h.status}{" "}
                      <Typography.Text type="secondary">{formatDateTime(h.at)}</Typography.Text>
                      {h.note && <div>{h.note}</div>}
                    </>
                  ),
                }))}
              />
            }
          >
            <Tag color={VISA_STATUS_COLOR[l.status]} style={{ cursor: "help" }}>
              {VISA_STATUS_LABEL[l.status] ?? l.status}
            </Tag>
          </Popover>
          {l.deliveryDate && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Delivered {formatDate(l.deliveryDate)}
            </Typography.Text>
          )}
          {!l.deliveryDate && l.expectedDate && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Expected {formatDate(l.expectedDate)}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    ...(flags.canEdit && live
      ? [
          {
            key: "move",
            title: "Move to",
            render: (_: unknown, l: Line) => <VisaStatusButtons lineId={l.id} status={l.status} />,
          },
        ]
      : []),
  ];

  return (
    <InvoiceShell invoice={invoice} {...flags}>
      <Card title={`Passengers (${invoice.lines.length})`} style={{ marginBottom: 16 }}>
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
