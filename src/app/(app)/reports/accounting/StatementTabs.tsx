"use client";

import { Tabs } from "antd";
import { useUrlParams } from "@/components/useUrlParams";

export function StatementTabs({ active }: { active: string }) {
  const { setParams } = useUrlParams();
  return (
    <Tabs
      activeKey={active}
      onChange={(report) => setParams({ report: report === "trial-balance" ? null : report })}
      items={[
        { key: "trial-balance", label: "Trial Balance" },
        { key: "balance-sheet", label: "Balance Sheet" },
      ]}
    />
  );
}
