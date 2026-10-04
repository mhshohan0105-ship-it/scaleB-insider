"use client";

import { Tabs } from "antd";
import { useRouter } from "next/navigation";
import { MASTERS, TOUR_MASTER_KEYS, type MasterKey } from "@/lib/masters";

export function TourTabs({ active }: { active: MasterKey }) {
  const router = useRouter();
  return (
    <Tabs
      activeKey={active}
      onChange={(tab) => router.push(`/settings/tour?tab=${tab}`)}
      items={TOUR_MASTER_KEYS.map((k) => ({ key: k, label: MASTERS[k].title }))}
    />
  );
}
