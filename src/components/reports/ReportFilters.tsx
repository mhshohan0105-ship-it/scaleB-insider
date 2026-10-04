"use client";

import { DatePicker, Flex, InputNumber, Select, Typography } from "antd";
import dayjs from "dayjs";
import type { FieldOption, PartyKey } from "@/lib/masters";
import { PARTIES } from "@/lib/parties";
import type { ReportParams } from "@/lib/reports/params";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { PartySelect } from "@/components/PartySelect";
import { useUrlParams } from "@/components/useUrlParams";

export type ReportFilterKind =
  | "dateRange"
  | "asOf"
  | "party"
  | "partyId"
  | "show"
  | "client"
  | "salesman"
  | "airline"
  | "vendor"
  | "group"
  | "user"
  | "year";

interface Props {
  params: ReportParams;
  show: ReportFilterKind[];
  salesmen?: FieldOption[];
  airlines?: FieldOption[];
  groups?: FieldOption[];
  users?: FieldOption[];
  /** Label for the period filter (e.g. "Journey dates"). */
  periodLabel?: string;
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Flex vertical gap={4}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Typography.Text>
      {children}
    </Flex>
  );
}

/** Filter bar for report pages; every change goes into the URL. */
export function ReportFilters({
  params,
  show,
  salesmen = [],
  airlines = [],
  groups = [],
  users = [],
  periodLabel = "Period",
}: Props) {
  const { setParams } = useUrlParams();
  const has = (k: ReportFilterKind) => show.includes(k);

  return (
    <Flex gap={16} wrap align="flex-end">
      {has("party") && (
        <Labelled label="Party type">
          <Select<PartyKey>
            style={{ width: 170 }}
            value={params.party}
            onChange={(party) => setParams({ party, partyId: null })}
            options={(Object.keys(PARTIES) as PartyKey[]).map((k) => ({
              value: k,
              label: PARTIES[k].title,
            }))}
          />
        </Labelled>
      )}
      {has("partyId") && (
        <Labelled label={PARTIES[params.party].singular}>
          <div style={{ width: 300 }}>
            <PartySelect
              key={params.party}
              id="report_partyId"
              party={params.party}
              value={params.partyId ?? null}
              onChange={(partyId) => setParams({ partyId })}
            />
          </div>
        </Labelled>
      )}
      {has("dateRange") && (
        <Labelled label={periodLabel}>
          <DateRangeFilter from={params.from} to={params.to} />
        </Labelled>
      )}
      {has("asOf") && (
        <Labelled label="As of">
          <DatePicker
            format="DD MMM YYYY"
            value={params.asOf ? dayjs(params.asOf) : null}
            placeholder="Today"
            onChange={(d) => setParams({ asOf: d ? d.format("YYYY-MM-DD") : null })}
          />
        </Labelled>
      )}
      {has("show") && (
        <Labelled label="Show">
          <Select
            style={{ width: 180 }}
            value={params.show}
            onChange={(v) => setParams({ show: v === "all" ? null : v })}
            options={[
              { value: "all", label: "Due and advance" },
              { value: "due", label: "Due only" },
              { value: "advance", label: "Advance only" },
            ]}
          />
        </Labelled>
      )}
      {has("client") && (
        <Labelled label="Client">
          <div style={{ width: 260 }}>
            <PartySelect
              party="clients"
              value={params.clientId ?? null}
              onChange={(clientId) => setParams({ clientId })}
              placeholder="All clients"
            />
          </div>
        </Labelled>
      )}
      {has("salesman") && (
        <Labelled label="Sold by">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 200 }}
            placeholder="Everyone"
            value={params.salesmanId}
            options={salesmen}
            onChange={(v) => setParams({ salesmanId: v ?? null })}
          />
        </Labelled>
      )}
      {has("airline") && (
        <Labelled label="Airline">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 220 }}
            placeholder="All airlines"
            value={params.airlineId}
            options={airlines}
            onChange={(v) => setParams({ airlineId: v ?? null })}
          />
        </Labelled>
      )}
      {has("vendor") && (
        <Labelled label="Vendor">
          <div style={{ width: 260 }}>
            <PartySelect
              party="vendors"
              id="report_vendorId"
              value={params.vendorId ?? null}
              onChange={(vendorId) => setParams({ vendorId })}
              placeholder="All vendors"
            />
          </div>
        </Labelled>
      )}
      {has("group") && (
        <Labelled label="Group">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 220 }}
            placeholder="All groups"
            value={params.groupId}
            options={groups}
            onChange={(v) => setParams({ groupId: v ?? null })}
          />
        </Labelled>
      )}
      {has("year") && (
        <Labelled label="Hajj year">
          <InputNumber
            min={2000}
            max={2100}
            placeholder="Any"
            value={params.year}
            onChange={(v) => setParams({ year: v ? String(v) : null })}
          />
        </Labelled>
      )}
      {has("user") && (
        <Labelled label="User">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 200 }}
            placeholder="Everyone"
            value={params.userId}
            options={users}
            onChange={(v) => setParams({ userId: v ?? null })}
          />
        </Labelled>
      )}
    </Flex>
  );
}
