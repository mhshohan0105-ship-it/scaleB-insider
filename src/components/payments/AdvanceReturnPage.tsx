"use client";

import Link from "next/link";
import { Card, Col, Row, Typography } from "antd";
import type { TableColumnsType } from "antd";
import type { ActionResult } from "@/lib/actionResult";
import { formatDate, formatMoney } from "@/lib/format";
import type { ListParams } from "@/lib/listParams";
import type { AdvanceReturnRow } from "@/server/services/payments/advanceReturnService";
import { DataTable } from "@/components/DataTable";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { PageHeader } from "@/components/PageHeader";
import { DocumentStatusTag } from "@/components/StatusTag";
import { VoidButton } from "@/components/VoidButton";
import { PaymentFormCard, type AccountOption } from "./PaymentFormCard";

interface Props {
  party: "clients" | "vendors";
  accounts: AccountOption[];
  returns: { rows: AdvanceReturnRow[]; total: number };
  params: ListParams;
  today: string;
  canCreate: boolean;
  canVoid: boolean;
  onCreate: (
    values: Record<string, unknown>,
  ) => Promise<ActionResult<{ id: string; number: string }>>;
  onVoid: (id: string, values: { reason: string }) => Promise<ActionResult<unknown>>;
}

const COPY = {
  clients: {
    title: "Client Advance Return",
    description: "Pay back money a client has in advance with you.",
    partyLabel: "Client",
    accountLabel: "Paid from",
    submit: "Pay back",
    help: "Only up to the client's advance (credit) balance can be returned.",
  },
  vendors: {
    title: "Vendor Advance Return",
    description: "Record a vendor paying back an advance you had given them.",
    partyLabel: "Vendor",
    accountLabel: "Received into",
    submit: "Record return",
    help: "Only up to what the vendor owes you (an advance or overpayment) can be recorded.",
  },
};

export function AdvanceReturnPage({
  party,
  accounts,
  returns,
  params,
  today,
  canCreate,
  canVoid,
  onCreate,
  onVoid,
}: Props) {
  const copy = COPY[party];
  const columns: TableColumnsType<AdvanceReturnRow> = [
    { title: "Date", dataIndex: "date", key: "date", render: (v: string) => formatDate(v) },
    { title: "No.", dataIndex: "number", key: "number" },
    {
      title: copy.partyLabel,
      key: "party",
      render: (_, r) => <Link href={`/${party}/${r.partyId}`}>{r.partyName}</Link>,
    },
    { title: "Account", dataIndex: "account", key: "account" },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      align: "right",
      render: (v: string) => formatMoney(v),
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
            render: (_: unknown, r: AdvanceReturnRow) =>
              r.status === "POSTED" && (
                <VoidButton
                  what={r.number}
                  buttonProps={{ size: "small", type: "link" }}
                  onVoid={(v) => onVoid(r.id, v)}
                />
              ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader title={copy.title} description={copy.description} />
      <Row gutter={16}>
        {canCreate && (
          <Col xs={24} xl={9}>
            <PaymentFormCard
              title="New advance return"
              party={party}
              partyField="partyId"
              partyLabel={copy.partyLabel}
              accountLabel={copy.accountLabel}
              submitLabel={copy.submit}
              accounts={accounts}
              today={today}
              help={<Typography.Paragraph type="secondary">{copy.help}</Typography.Paragraph>}
              onSubmit={onCreate}
            />
          </Col>
        )}
        <Col xs={24} xl={canCreate ? 15 : 24}>
          <Card title="History">
            <div style={{ marginBottom: 12 }}>
              <DateRangeFilter from={params.from} to={params.to} />
            </div>
            <DataTable<AdvanceReturnRow>
              rows={returns.rows}
              total={returns.total}
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
