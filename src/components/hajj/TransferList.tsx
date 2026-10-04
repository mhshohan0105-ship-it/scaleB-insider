"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Flex, Input, Space, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { formatDate, formatMoney } from "@/lib/format";
import { TRANSFER_TYPE_LABEL } from "@/lib/hajj";
import type { ListParams } from "@/lib/listParams";
import type { TransferList as Data, TransferRow } from "@/server/services/hajj/transferService";
import { DataTable } from "@/components/DataTable";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { PageHeader } from "@/components/PageHeader";
import { DocumentStatusTag } from "@/components/StatusTag";
import { VoidButton } from "@/components/VoidButton";
import { useUrlParams } from "@/components/useUrlParams";
import { voidTransferAction } from "@/app/(app)/hajj/actions";

interface Props {
  type: string;
  data: Data;
  params: ListParams;
  canVoid: boolean;
  /** Show a page header (the list has its own page) or not (below a form). */
  withHeader?: boolean;
}

const TO_TITLE: Record<string, string> = {
  MOALLEM: "New moallem",
  GROUP: "New group",
  OUT: "To agency",
  IN: "From agency",
};

export function TransferList({ type, data, params, canVoid, withHeader = true }: Props) {
  const { setParams } = useUrlParams();
  const [search, setSearch] = useState(params.q);

  const columns: TableColumnsType<TransferRow> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 115,
      render: (v: string) => formatDate(v),
    },
    { title: "Number", dataIndex: "number", key: "number" },
    {
      title: "Pilgrims",
      key: "pilgrims",
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          {r.pilgrims.map((p) => (
            <span key={p.id}>
              <Link href={`/hajj/pilgrims/${p.id}`}>{p.name}</Link>
              {p.from && (type === "MOALLEM" || type === "GROUP") && (
                <Typography.Text type="secondary"> (was {p.from})</Typography.Text>
              )}
            </span>
          ))}
        </Space>
      ),
    },
    { title: TO_TITLE[type] ?? "To", dataIndex: "toLabel", key: "to" },
    {
      title: "Charge",
      dataIndex: "totalCharge",
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
            title: "",
            key: "void",
            render: (_: unknown, r: TransferRow) =>
              r.status === "POSTED" && (
                <VoidButton
                  what={`transfer ${r.number}`}
                  description="Every pilgrim goes back to what they had before, and any charge is reversed."
                  buttonProps={{ size: "small" }}
                  onVoid={(v) => voidTransferAction(r.id, v)}
                />
              ),
          },
        ]
      : []),
  ];

  return (
    <>
      {withHeader && <PageHeader title={`${TRANSFER_TYPE_LABEL[type]} List`} />}
      <Card title={withHeader ? undefined : "Recent transfers"}>
        <Flex gap={12} wrap style={{ marginBottom: 16 }}>
          <Input.Search
            allowClear
            placeholder="Number, pilgrim, tracking no. or target"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(v) => setParams({ q: v })}
            style={{ width: 320 }}
          />
          <DateRangeFilter from={params.from} to={params.to} />
        </Flex>
        <DataTable<TransferRow>
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
