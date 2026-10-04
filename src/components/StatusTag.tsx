"use client";

import { Tag } from "antd";

const STATUS: Record<string, { color: string; label: string }> = {
  DRAFT: { color: "default", label: "Draft" },
  POSTED: { color: "blue", label: "Unpaid" },
  PARTIAL: { color: "orange", label: "Partly paid" },
  PAID: { color: "green", label: "Paid" },
  VOID: { color: "red", label: "Void" },
  REFUNDED: { color: "purple", label: "Refunded" },
};

/** Invoice / document status as a coloured tag. */
export function StatusTag({ status }: { status: string }) {
  const s = STATUS[status] ?? { color: "default", label: status };
  return <Tag color={s.color}>{s.label}</Tag>;
}

/** Posted / void tag for receipts, payments and transfers. */
export function DocumentStatusTag({ status, reason }: { status: string; reason?: string | null }) {
  return status === "VOID" ? (
    <Tag color="red" title={reason ?? undefined}>
      Void
    </Tag>
  ) : (
    <Tag color="green">Posted</Tag>
  );
}
