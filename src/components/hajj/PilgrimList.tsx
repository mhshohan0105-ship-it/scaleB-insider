"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Flex, Input, InputNumber, Select, Statistic } from "antd";
import type { TableColumnsType } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { PILGRIM_STATUSES, PILGRIM_STATUS_LABEL, pilgrimActionError } from "@/lib/hajj";
import type { ListParams } from "@/lib/listParams";
import type { FieldOption } from "@/lib/masters";
import type { PilgrimRow } from "@/server/services/hajj/pilgrimService";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { useUrlParams } from "@/components/useUrlParams";
import { PilgrimStatusTag } from "./PilgrimStatusTag";
import { RegisterButton } from "./RegisterButton";

interface Props {
  data: { rows: PilgrimRow[]; total: number; counts: Record<string, number> };
  params: ListParams;
  filters: { pilgrimStatus?: string; year?: number; groupId?: string };
  groups: FieldOption[];
  canCreate: boolean;
  canEdit: boolean;
  today: string;
}

/** Hajj Registration: every pilgrim with their stage, and the register action. */
export function PilgrimList({ data, params, filters, groups, canCreate, canEdit, today }: Props) {
  const { setParams } = useUrlParams();
  const [search, setSearch] = useState(params.q);

  const columns: TableColumnsType<PilgrimRow> = [
    {
      title: "Pilgrim",
      key: "name",
      render: (_, r) => (
        <>
          <Link href={`/hajj/pilgrims/${r.id}`}>{r.name}</Link>
          <div style={{ fontSize: 12, color: "#888" }}>
            {[r.passportNo, r.phone].filter(Boolean).join(" · ") || "-"}
          </div>
        </>
      ),
    },
    { title: "Year", dataIndex: "hajjYear", key: "year", width: 70 },
    {
      title: "Tracking / Reg.",
      key: "nos",
      render: (_, r) => (
        <>
          {r.trackingNo ?? "-"}
          {r.regNo && <div style={{ fontSize: 12, color: "#888" }}>Reg {r.regNo}</div>}
        </>
      ),
    },
    {
      title: "Paying client",
      key: "client",
      render: (_, r) => <Link href={`/clients/${r.clientId}`}>{r.clientName}</Link>,
    },
    { title: "Group", dataIndex: "group", key: "group", render: (v: string | null) => v ?? "-" },
    {
      title: "Moallem",
      dataIndex: "moallem",
      key: "moallem",
      render: (v: string | null) => v ?? "-",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v: string) => <PilgrimStatusTag status={v} />,
    },
    ...(canEdit
      ? [
          {
            title: "",
            key: "act",
            render: (_: unknown, r: PilgrimRow) =>
              pilgrimActionError("REGISTER", r) ? null : (
                <RegisterButton
                  pilgrimId={r.id}
                  name={r.name}
                  trackingNo={r.trackingNo}
                  today={today}
                  buttonProps={{ size: "small" }}
                />
              ),
          },
        ]
      : []),
  ];

  const count = (k: string) => data.counts[k] ?? 0;

  return (
    <>
      <PageHeader
        title="Hajj Registration"
        description="Pilgrims by stage. Register a pilgrim once the registration number is issued."
        extra={
          canCreate && (
            <Link href="/hajj/pilgrims/new">
              <Button type="primary" icon={<PlusOutlined />}>
                Add pilgrim
              </Button>
            </Link>
          )
        }
      />
      <Card style={{ marginBottom: 16 }}>
        <Flex gap={12} wrap>
          <Input.Search
            allowClear
            placeholder="Name, passport, tracking, reg. no., phone or client"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(v) => setParams({ q: v })}
            style={{ width: 340 }}
          />
          <Select
            style={{ width: 180 }}
            value={filters.pilgrimStatus ?? ""}
            onChange={(v) => setParams({ pilgrimStatus: v })}
            options={[
              { value: "", label: "All stages" },
              { value: "ACTIVE", label: "Active" },
              ...PILGRIM_STATUSES.map((s) => ({ value: s, label: PILGRIM_STATUS_LABEL[s] })),
            ]}
            aria-label="Stage"
          />
          <InputNumber
            placeholder="Hajj year"
            min={2000}
            max={2100}
            value={filters.year}
            onChange={(v) => setParams({ year: v ? String(v) : "" })}
            aria-label="Hajj year"
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Group"
            style={{ width: 200 }}
            value={filters.groupId}
            onChange={(v) => setParams({ groupId: v ?? "" })}
            options={groups}
            aria-label="Group"
          />
        </Flex>
        <Flex gap={48} wrap style={{ marginTop: 16 }}>
          <Statistic title="Pre registered" value={count("PRE_REGISTERED")} />
          <Statistic title="Registered" value={count("REGISTERED")} />
          <Statistic title="Transferred in" value={count("TRANSFERRED_IN")} />
          <Statistic title="Transferred out" value={count("TRANSFERRED_OUT")} />
          <Statistic title="Cancelled" value={count("CANCELLED")} />
        </Flex>
      </Card>
      <Card>
        <DataTable<PilgrimRow>
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
