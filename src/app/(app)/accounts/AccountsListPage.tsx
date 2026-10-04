"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import Decimal from "decimal.js";
import { formatMoney } from "@/lib/format";
import { MONEY_ACCOUNT_KIND_OPTIONS } from "@/lib/schemas/accounts";
import type { LedgerRow, MoneyAccountRow } from "@/server/services/accounts/moneyAccountService";
import { MoneyInput } from "@/components/MoneyInput";
import { PageHeader } from "@/components/PageHeader";
import { applyActionResult } from "@/components/formResult";
import type { PeriodRow } from "@/server/services/accounts/periodService";
import { PeriodsTable } from "./PeriodsTable";
import { saveMoneyAccountAction, setMoneyAccountActiveAction } from "./actions";

const KIND_LABEL = Object.fromEntries(MONEY_ACCOUNT_KIND_OPTIONS.map((o) => [o.value, o.label]));
interface AccountForm {
  name: string;
  kind: string;
  bankName?: string | null;
  accountNo?: string | null;
  branch?: string | null;
  openingBalance: string;
  note?: string | null;
}

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
  const [form] = Form.useForm<AccountForm>();
  const [editing, setEditing] = useState<MoneyAccountRow | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const kind = Form.useWatch("kind", form);
  const row = editing && editing !== "new" ? editing : null;

  async function save() {
    const values = await form.validateFields();
    setSaving(true);
    const result = await saveMoneyAccountAction(row?.id ?? null, values);
    setSaving(false);
    if (applyActionResult(result, form, message, row ? "Account updated" : "Account added")) {
      setEditing(null);
      router.refresh();
    }
  }

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
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    setEditing(a);
                    form.setFieldsValue({ ...a, accountNo: "" });
                  }}
                >
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
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing("new");
                form.resetFields();
                form.setFieldsValue({ kind: "BANK", openingBalance: "0" });
              }}
            >
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

      <Modal
        open={editing !== null}
        title={row ? `Edit ${row.name}` : "Add Account"}
        okText={row ? "Save changes" : "Add"}
        confirmLoading={saving}
        onOk={save}
        onCancel={() => setEditing(null)}
        forceRender
      >
        <Form form={form} name="moneyAccount" layout="vertical" requiredMark="optional">
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                label="Account name"
                name="name"
                rules={[{ required: true, message: "Account name is required" }]}
              >
                <Input maxLength={80} placeholder="e.g. City Bank Current" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label="Type" name="kind" rules={[{ required: true }]}>
                <Select options={[...MONEY_ACCOUNT_KIND_OPTIONS]} />
              </Form.Item>
            </Col>
            {kind !== "CASH" && (
              <>
                <Col span={12}>
                  <Form.Item
                    label={kind === "MOBILE_BANKING" ? "Provider" : "Bank"}
                    name="bankName"
                  >
                    <Input
                      maxLength={120}
                      placeholder={kind === "MOBILE_BANKING" ? "bKash, Nagad, ..." : undefined}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Account / wallet number"
                    name="accountNo"
                    extra={
                      row?.accountNoMasked
                        ? `Stored as ${row.accountNoMasked}. Leave blank to keep it.`
                        : "Only the last 4 digits are stored."
                    }
                  >
                    <Input maxLength={40} autoComplete="off" />
                  </Form.Item>
                </Col>
                {kind === "BANK" && (
                  <Col span={24}>
                    <Form.Item label="Branch" name="branch">
                      <Input maxLength={120} />
                    </Form.Item>
                  </Col>
                )}
              </>
            )}
            <Col span={24}>
              <Form.Item
                label="Opening balance"
                name="openingBalance"
                rules={[{ required: true, message: "Opening balance is required" }]}
                extra="Money in this account when you started using scaleB Insider."
              >
                <MoneyInput />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Note" name="note">
                <Input.TextArea rows={2} maxLength={500} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
}
