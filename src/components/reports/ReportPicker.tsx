"use client";

import { Flex, Select, Typography } from "antd";
import { useUrlParams } from "@/components/useUrlParams";

/** Chooses one report of a group; filters that only some reports use are reset. */
export function ReportPicker({
  title,
  active,
  reports,
}: {
  title: string;
  active: string;
  reports: { key: string; label: string }[];
}) {
  const { setParams } = useUrlParams();
  return (
    <Flex align="center" gap={12} wrap style={{ marginBottom: 16 }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        {title} reports
      </Typography.Title>
      <Select
        showSearch
        optionFilterProp="label"
        style={{ minWidth: 260 }}
        value={active}
        options={reports.map((r) => ({ value: r.key, label: r.label }))}
        onChange={(report) =>
          setParams({
            report,
            clientId: null,
            salesmanId: null,
            airlineId: null,
            vendorId: null,
            groupId: null,
            userId: null,
            year: null,
            from: null,
            to: null,
          })
        }
        aria-label="Report"
      />
    </Flex>
  );
}
