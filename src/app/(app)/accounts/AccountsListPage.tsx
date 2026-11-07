"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { App, Button, Card, Popconfirm, Space, Table, Tabs, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import Decimal from "decimal.js";
import { formatMoney } from "@/lib/format";
import { MONEY_ACCOUNT_KIND_OPTIONS } from "@/lib/schemas/accounts";
import type { LedgerRow, MoneyAccountRow } from "@/server/services/accounts/moneyAccountService";
import { PageHeader } from "@/components/PageHeader";
import { MoneyAccountModal } from "@/components/accounts/MoneyAccountModal";
import { applyActionResult } from "@/components/formResult";
import type { PeriodRow } from "@/server/services/accounts/periodService";
import { PeriodsTable } from "./PeriodsTable";
import { setMoneyAccountActiveAction } from "./actions";

const KIND_LABEL = Object.fromEntries(MONEY_ACCOUNT_KIND_OPTIONS.map((o) => [o.value, o.label]));
const TYPE_COLOR: Record<string, string> = {
  ASSET: "blue",
  LIABILITY: "orange",
  EQUITY: "purple",
  INCOME: "green",
  EXPENSE: "red",
};

export function AccountsListPage({
  accounts,
  ledgers,
  periods,
  canCreate,
  canEdit,
}: {
  accounts: MoneyAccountRow[];
  ledgers: LedgerRow[];
  periods: PeriodRow[];
  canCreate: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<MoneyAccountRow | "new" | null>(null);
  const row = editing && editing !== "new" ? editing : null;

  const moneyColumns: TableColumnsType<MoneyAccountRow> = [
    {
      title: "Account",
      key: "name",
      render: (_, a) => (
        <Space direction="vertical" size={0}>
          <Link href={`/accounts/transactions?account=${a.id}`}>{a.name}</Link>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {[a.bankName, a.accountNoMasked, a.branch].filter(Boolean).join(" · ") ||
              `Ledger ${a.ledgerCode}`}
          </Typography.Text>
        </Space>
      ),
    },
    { title: "Type", dataIndex: "kind", key: "kind", render: (k: string) => KIND_LABEL[k] },
    {
      title: "Balance",
      dataIndex: "balance",
      key: "balance",
      align: "right",
      render: (v: string) => (
        <Typography.Text strong type={v.startsWith("-") ? "danger" : undefined}>
          {formatMoney(v)}
        </Typography.Text>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (_, a) => (a.isActive ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>),
    },
    ...(canEdit
      ? [
          {
            key: "actions",
            align: "right" as const,
            render: (_: unknown, a: MoneyAccountRow) => (
              <Space size={4}>
                <Button type="link" size="small" onClick={() => setEditing(a)}>
                  Edit
                </Button>
                <Popconfirm
                  title={a.isActive ? "Deactivate this account?" : "Activate again?"}
                  onConfirm={async () => {
                    const r = await setMoneyAccountActiveAction(a.id, !a.isActive);
                    if (
                      applyActionResult(r, null, message, a.isActive ? "Deactivated" : "Activated")
                    ) {
                      router.refresh();
                    }
                  }}
                >
                  <Button type="link" size="small" danger={a.isActive}>
                    {a.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ];

  const ledgerColumns: TableColumnsType<LedgerRow> = [
    { title: "Code", dataIndex: "code", key: "code", width: 90 },
    { title: "Account", dataIndex: "name", key: "name" },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (t: string) => (
        <Tag color={TYPE_COLOR[t]}>{t.charAt(0) + t.slice(1).toLowerCase()}</Tag>
      ),
    },
    {
      title: "Balance",
      dataIndex: "balance",
      key: "balance",
      align: "right",
      render: (v: string) => formatMoney(v),
    },
  ];

  const total = accounts
    .filter((a) => a.isActive)
    .reduce((acc, a) => acc.plus(a.balance), new Decimal(0));

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Cash, bank, mobile banking and card accounts, and the chart of accounts behind them."
        extra={
          canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing("new")}>
              Add Account
            </Button>
          )
        }
      />
      <Card>
        <Tabs
          items={[
            {
              key: "money",
              label: "Money accounts",
              children: (
                <Table<MoneyAccountRow>
                  rowKey="id"
                  columns={moneyColumns}
                  dataSource={accounts}
                  pagination={false}
                  scroll={{ x: "max-content" }}
                  summary={() => (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={2}>
                        <strong>Total (active accounts)</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <strong>{formatMoney(total)}</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} colSpan={2} />
                    </Table.Summary.Row>
                  )}
                />
              ),
            },
            {
              key: "periods",
              label: "Closed months",
              children: <PeriodsTable periods={periods} canEdit={canEdit} />,
            },
            {
              key: "chart",
              label: "Chart of accounts",
              children: (
                <Table<LedgerRow>
                  rowKey="id"
                  size="small"
                  columns={ledgerColumns}
                  dataSource={ledgers}
                  pagination={false}
                />
              ),
            },
          ]}
        />
      </Card>

      <MoneyAccountModal
        open={editing !== null}
        editing={row}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </>
  );
}
