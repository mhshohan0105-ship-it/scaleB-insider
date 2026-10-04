"use client";

import { Card, Flex, Select, Statistic, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { formatDate, formatMoney } from "@/lib/format";
import type { ListParams } from "@/lib/listParams";
import type {
  TransactionHistory,
  TransactionRow,
} from "@/server/services/accounts/transactionHistory";
import { DataTable } from "@/components/DataTable";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { PageHeader } from "@/components/PageHeader";
import { useUrlParams } from "@/components/useUrlParams";

interface Props {
  history: TransactionHistory;
  params: ListParams;
  account?: string;
  sourceType?: string;
  accounts: { value: string; label: string; balance: string }[];
  sourceTypes: { value: string; label: string }[];
}

export function TransactionsPage({
  history,
  params,
  account,
  sourceType,
  accounts,
  sourceTypes,
}: Props) {
  const { setParams } = useUrlParams();
  const typeLabel = Object.fromEntries(sourceTypes.map((t) => [t.value, t.label]));
  const selected = accounts.find((a) => a.value === account);

  const amount = (v: string) =>
    v === "0.00" ? <Typography.Text type="secondary">-</Typography.Text> : formatMoney(v);

  const columns: TableColumnsType<TransactionRow> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 120,
      render: (d: string) => formatDate(d),
    },
    { title: "Voucher", dataIndex: "number", key: "number", width: 140 },
    ...(account ? [] : [{ title: "Account", dataIndex: "account", key: "account" }]),
    {
      title: "Details",
      key: "details",
      render: (_, r) => (
        <>
          <div>{r.narration}</div>
          <Tag style={{ marginTop: 4 }}>{typeLabel[r.sourceType] ?? r.sourceType}</Tag>
          {r.memo && <Typography.Text type="secondary">{r.memo}</Typography.Text>}
        </>
      ),
    },
    { title: "Money in", dataIndex: "moneyIn", key: "in", align: "right", render: amount },
    { title: "Money out", dataIndex: "moneyOut", key: "out", align: "right", render: amount },
    {
      title: "Balance",
      dataIndex: "runningBalance",
      key: "balance",
      align: "right",
      render: (v: string) => <Typography.Text strong>{formatMoney(v)}</Typography.Text>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Transaction History"
        description="Every movement in your cash, bank, mobile banking and card accounts."
      />
      <Card style={{ marginBottom: 16 }}>
        <Flex gap={8} wrap align="center">
          <Select
            allowClear
            placeholder="All accounts"
            style={{ width: 240 }}
            value={account}
            options={accounts.map((a) => ({ value: a.value, label: a.label }))}
            onChange={(v) => setParams({ account: v ?? null })}
          />
          <DateRangeFilter from={params.from} to={params.to} />
          <Select
            allowClear
            placeholder="All transaction types"
            style={{ width: 220 }}
            value={sourceType}
            options={sourceTypes}
            onChange={(v) => setParams({ type: v ?? null })}
          />
        </Flex>
        <Flex gap={48} wrap style={{ marginTop: 16 }}>
          <Statistic title="Money in (filtered)" value={formatMoney(history.totalIn)} />
          <Statistic title="Money out (filtered)" value={formatMoney(history.totalOut)} />
          {selected && (
            <Statistic
              title={`Current balance, ${selected.label}`}
              value={formatMoney(selected.balance)}
            />
          )}
        </Flex>
      </Card>
      <Card>
        <DataTable<TransactionRow>
          rows={history.rows}
          total={history.total}
          page={params.page}
          pageSize={params.pageSize}
          columns={columns}
        />
        {!account && history.total > 0 && (
          <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            The balance column shows each line&apos;s own account balance. Pick one account to read
            it as a statement.
          </Typography.Paragraph>
        )}
      </Card>
    </>
  );
}
