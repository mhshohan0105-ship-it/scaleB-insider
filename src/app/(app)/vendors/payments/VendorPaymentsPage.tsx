"use client";

import Link from "next/link";
import { Card, Col, Flex, Row, Statistic } from "antd";
import type { TableColumnsType } from "antd";
import { formatDate, formatMoney } from "@/lib/format";
import type { ListParams } from "@/lib/listParams";
import type { VendorPaymentRow } from "@/server/services/payments/vendorPaymentService";
import { DataTable } from "@/components/DataTable";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { PageHeader } from "@/components/PageHeader";
import { DocumentStatusTag } from "@/components/StatusTag";
import { VoidButton } from "@/components/VoidButton";
import { PaymentFormCard, type AccountOption } from "@/components/payments/PaymentFormCard";
import { createVendorPaymentAction, voidVendorPaymentAction } from "../paymentActions";

interface Props {
  accounts: AccountOption[];
  payments: { rows: VendorPaymentRow[]; total: number; totalAmount: string };
  params: ListParams;
  today: string;
  canCreate: boolean;
  canVoid: boolean;
}

export function VendorPaymentsPage({
  accounts,
  payments,
  params,
  today,
  canCreate,
  canVoid,
}: Props) {
  const columns: TableColumnsType<VendorPaymentRow> = [
    { title: "Date", dataIndex: "date", key: "date", render: (v: string) => formatDate(v) },
    { title: "No.", dataIndex: "number", key: "number" },
    {
      title: "Vendor",
      key: "vendor",
      render: (_, r) => (
        <>
          <Link href={`/vendors/${r.vendorId}`}>{r.vendorName}</Link>
          {r.reference && <div style={{ fontSize: 12, color: "#888" }}>{r.reference}</div>}
        </>
      ),
    },
    { title: "From", dataIndex: "account", key: "account" },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
    {
      title: "Charge",
      dataIndex: "transactionCharge",
      key: "charge",
      align: "right",
      render: (v: string) => (v === "0.00" ? "-" : formatMoney(v)),
    },
    {
      title: "Status",
      key: "status",
      render: (_, r) => <DocumentStatusTag status={r.status} reason={r.voidReason} />,
    },
    ...(canVoid
      ? [
          {
            key: "actions",
            align: "right" as const,
            render: (_: unknown, r: VendorPaymentRow) =>
              r.status === "POSTED" && (
                <VoidButton
                  what={`payment ${r.number}`}
                  buttonProps={{ size: "small", type: "link" }}
                  onVoid={(v) => voidVendorPaymentAction(r.id, v)}
                />
              ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Vendor Payments"
        description="Money paid to airlines, consolidators and other suppliers."
      />
      <Row gutter={16}>
        {canCreate && (
          <Col xs={24} xl={9}>
            <PaymentFormCard
              title="New payment"
              party="vendors"
              partyField="vendorId"
              partyLabel="Vendor"
              accountLabel="Paid from"
              submitLabel="Save payment"
              accounts={accounts}
              today={today}
              full
              onSubmit={createVendorPaymentAction}
            />
          </Col>
        )}
        <Col xs={24} xl={canCreate ? 15 : 24}>
          <Card title="Payment history">
            <Flex justify="space-between" wrap gap={8} style={{ marginBottom: 12 }}>
              <DateRangeFilter from={params.from} to={params.to} />
              <Statistic
                title="Paid (filtered, excl. void)"
                value={formatMoney(payments.totalAmount)}
              />
            </Flex>
            <DataTable<VendorPaymentRow>
              rows={payments.rows}
              total={payments.total}
              page={params.page}
              pageSize={params.pageSize}
              columns={columns}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
