"use client";

import { Tag } from "antd";
import { PILGRIM_STATUS_COLOR, PILGRIM_STATUS_LABEL, type PilgrimStatusKey } from "@/lib/hajj";

export function PilgrimStatusTag({ status }: { status: string }) {
  const s = status as PilgrimStatusKey;
  return (
    <Tag color={PILGRIM_STATUS_COLOR[s] ?? "default"}>{PILGRIM_STATUS_LABEL[s] ?? status}</Tag>
  );
}
