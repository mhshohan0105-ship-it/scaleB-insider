"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Card, Flex, Input, Popconfirm, Select, Space, Tag } from "antd";
import type { TableColumnsType } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import Link from "next/link";
import { ENTITIES } from "@/lib/entities";
import { listedFields, refLabelKey, type EntityKey, type FieldOption } from "@/lib/masters";
import type { ListParams } from "@/lib/listParams";
import { formatDate, formatMoney } from "@/lib/format";
import type { MasterRow } from "@/server/services/masters/masterService";
import { DataTable } from "@/components/DataTable";
import { BALANCE_LABELS, BalanceAmount } from "@/components/parties/BalanceAmount";
import { PageHeader } from "@/components/PageHeader";
import { useUrlParams } from "@/components/useUrlParams";
import { setEntityActiveAction } from "@/app/(app)/entityActions";
import { MasterForm } from "./MasterForm";

interface MasterPageProps {
  masterKey: EntityKey;
  rows: MasterRow[];
  total: number;
  params: ListParams;
  refOptions: Record<string, FieldOption[]>;
  canCreate: boolean;
  canEdit: boolean;
  /** Rendered above the table (e.g. tabs on the Tour Itinerary page). */
  top?: ReactNode;
  hideHeader?: boolean;
}

export function MasterPage({
  masterKey,
  rows,
  total,
  params,
  refOptions,
  canCreate,
  canEdit,
  top,
  hideHeader,
}: MasterPageProps) {
  const def = ENTITIES[masterKey];
  const router = useRouter();
  const { message } = App.useApp();
  const { setParams } = useUrlParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MasterRow | null>(null);
  const [search, setSearch] = useState(params.q);

  const columns = useMemo<TableColumnsType<MasterRow>>(() => {
    const cols: TableColumnsType<MasterRow> = listedFields(def).map((f) => ({
      key: f.name,
      title: f.label,
      dataIndex: f.name,
      align: f.type === "money" || f.type === "percent" ? ("right" as const) : undefined,
      render: (_: unknown, row: MasterRow) => {
        const v = row[f.name];
        if (v === null || v === undefined || v === "")
          return <span style={{ color: "#aaa" }}>-</span>;
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
            return f.name === "name" && def.profileBase ? (
              <Link href={`${def.profileBase}/${row.id}`}>{String(v)}</Link>
            ) : (
              String(v)
            );
        }
      },
    }));
    if (def.codePrefix) {
      cols.unshift({ key: "code", title: "Code", dataIndex: "code", width: 110 });
    }
    if (def.balance) {
      const labels = BALANCE_LABELS[def.key];
      cols.push({
        key: "balance",
        title: "Balance",
        align: "right",
        render: (_, row) => (
          <BalanceAmount
            value={row.balance as string}
            dueLabel={labels?.due}
            advanceLabel={labels?.advance}
          />
        ),
      });
    }
    cols.push({
      key: "status",
      title: "Status",
      width: 100,
      render: (_, row) =>
        row.isActive ? <Tag color="green">Active</Tag> : <Tag color="default">Inactive</Tag>,
    });
    if (canEdit) {
      cols.push({
        key: "actions",
        title: "",
        width: 170,
        align: "right",
        render: (_, row) => (
          <Space size={4}>
            <Button
              size="small"
              type="link"
              onClick={() => {
                setEditing(row);
                setFormOpen(true);
              }}
            >
              Edit
            </Button>
            <Popconfirm
              title={
                row.isActive ? `Deactivate this ${def.singular.toLowerCase()}?` : "Activate again?"
              }
              description={row.isActive ? "It will no longer appear in dropdowns." : undefined}
              onConfirm={async () => {
                const r = await setEntityActiveAction(def.key, row.id, !row.isActive);
                if (!r.ok) return void message.error(r.error);
                message.success(row.isActive ? "Deactivated" : "Activated");
                router.refresh();
              }}
            >
              <Button size="small" type="link" danger={row.isActive}>
                {row.isActive ? "Deactivate" : "Activate"}
              </Button>
            </Popconfirm>
          </Space>
        ),
      });
    }
    return cols;
  }, [def, canEdit, message, router]);

  return (
    <>
      {!hideHeader && (
        <PageHeader
          title={def.title}
          description={def.description}
          extra={
            canCreate && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Add {def.singular}
              </Button>
            )
          }
        />
      )}
      <Card>
        {top}
        <Flex gap={8} wrap style={{ marginBottom: 12 }} justify="space-between">
          <Flex gap={8} wrap>
            <Input.Search
              allowClear
              placeholder={`Search ${def.title.toLowerCase()}`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSearch={(q) => setParams({ q })}
              style={{ width: 280 }}
            />
            <Select
              value={params.status}
              onChange={(status) => setParams({ status: status === "active" ? null : status })}
              style={{ width: 130 }}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
                { value: "all", label: "All" },
              ]}
            />
          </Flex>
          {hideHeader && canCreate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Add {def.singular}
            </Button>
          )}
        </Flex>
        <DataTable<MasterRow>
          rows={rows}
          total={total}
          page={params.page}
          pageSize={params.pageSize}
          columns={columns}
        />
      </Card>
      <MasterForm
        def={def}
        open={formOpen}
        editing={editing}
        refOptions={refOptions}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
