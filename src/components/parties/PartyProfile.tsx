"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Popconfirm,
  Row,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { ArrowLeftOutlined, EditOutlined } from "@ant-design/icons";
import { refLabelKey, type FieldDef, type FieldOption, type PartyKey } from "@/lib/masters";
import { PARTIES } from "@/lib/parties";
import { formatDate, formatMoney } from "@/lib/format";
import type { MasterRow } from "@/server/services/masters/masterService";
import { MasterForm } from "@/components/masters/MasterForm";
import { setEntityActiveAction } from "@/app/(app)/entityActions";
import { BALANCE_LABELS, BalanceAmount } from "./BalanceAmount";

/** Latest build phase shipped; tabs from later phases show a note instead of data. */
export const BUILT_PHASE = 12;

interface PartyProfileProps {
  partyKey: PartyKey;
  row: MasterRow;
  refOptions: Record<string, FieldOption[]>;
  canEdit: boolean;
  /** Tab from the URL (?tab=...); "info" by default. */
  activeTab: string;
  /** Server-rendered content for the active tab (not needed for "info"). */
  panel?: ReactNode;
  /** Buttons shown next to Edit, e.g. "New invoice". */
  actions?: ReactNode;
  /** Shown under the balance (e.g. how a combined client's balance is made up). */
  balanceNote?: ReactNode;
}

function displayValue(f: FieldDef, row: MasterRow) {
  const v = row[f.name];
  if (v === null || v === undefined || v === "")
    return <Typography.Text type="secondary">-</Typography.Text>;
  switch (f.type) {
    case "ref":
      return row[refLabelKey(f.name)];
    case "select":
      return f.options?.find((o) => o.value === v)?.label ?? String(v);
    case "money":
      return formatMoney(String(v));
    case "percent":
      return `${v}%`;
    case "date":
      return formatDate(String(v));
    case "bool":
      return v ? "Yes" : "No";
    default:
      return <span style={{ whiteSpace: "pre-wrap" }}>{String(v)}</span>;
  }
}

export function PartyProfile({
  partyKey,
  row,
  refOptions,
  canEdit,
  activeTab,
  panel,
  actions,
  balanceNote,
}: PartyProfileProps) {
  const def = PARTIES[partyKey];
  const router = useRouter();
  const { message } = App.useApp();
  const [editing, setEditing] = useState(false);
  const labels = BALANCE_LABELS[partyKey];

  async function toggleActive() {
    const r = await setEntityActiveAction(def.key, row.id, !row.isActive);
    if (!r.ok) return void message.error(r.error);
    message.success(row.isActive ? `${def.singular} deactivated` : `${def.singular} activated`);
    router.refresh();
  }

  const infoFields = def.fields.filter((f) => f.name !== "name");

  return (
    <>
      <Link href={def.profileBase!} style={{ display: "inline-block", marginBottom: 12 }}>
        <ArrowLeftOutlined /> {def.title}
      </Link>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[24, 16]} align="middle">
          <Col flex="auto">
            <Space direction="vertical" size={4}>
              <Space wrap>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {String(row.name)}
                </Typography.Title>
                <Tag>{String(row.code)}</Tag>
                {row.isActive ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>}
              </Space>
              <Typography.Text type="secondary">
                {[row.phone, row.email].filter(Boolean).join(" · ") || def.singular}
              </Typography.Text>
            </Space>
          </Col>
          <Col>
            <Statistic
              title="Current balance"
              valueRender={() => (
                <BalanceAmount
                  value={row.balance as string}
                  dueLabel={labels?.due}
                  advanceLabel={labels?.advance}
                />
              )}
            />
            {balanceNote}
          </Col>
          {(canEdit || actions) && (
            <Col>
              <Space wrap>
                {actions}
                {canEdit && (
                  <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                )}
                {canEdit && (
                  <Popconfirm
                    title={
                      row.isActive
                        ? `Deactivate this ${def.singular.toLowerCase()}?`
                        : "Activate again?"
                    }
                    description={
                      row.isActive
                        ? "They will no longer appear when creating new documents."
                        : undefined
                    }
                    onConfirm={toggleActive}
                  >
                    <Button danger={row.isActive}>
                      {row.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </Col>
          )}
        </Row>
      </Card>

      <Card>
        <Tabs
          activeKey={activeTab}
          destroyOnHidden
          onChange={(tab) => router.push(tab === "info" ? "?" : `?tab=${tab}`)}
          items={[
            {
              key: "info",
              label: "Info",
              children: (
                <Descriptions
                  bordered
                  size="small"
                  column={{ xs: 1, md: 2 }}
                  items={[
                    { key: "code", label: "Code", children: String(row.code) },
                    ...infoFields.map((f) => ({
                      key: f.name,
                      label: f.label,
                      children: displayValue(f, row),
                      span: f.type === "textarea" ? ("filled" as const) : undefined,
                    })),
                  ]}
                />
              ),
            },
            ...def.profileTabs.map((t) => ({
              key: t.key,
              label: t.label,
              children:
                t.key === activeTab && panel ? (
                  panel
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      t.phase > BUILT_PHASE ? `${t.label} are not available yet.` : "Loading..."
                    }
                  />
                ),
            })),
          ]}
        />
      </Card>

      <MasterForm
        def={def}
        open={editing}
        editing={row}
        refOptions={refOptions}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          router.refresh();
        }}
      />
    </>
  );
}
