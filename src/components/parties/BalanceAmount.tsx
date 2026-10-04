"use client";

import { Typography } from "antd";
import Decimal from "decimal.js";
import { formatMoney } from "@/lib/format";

/**
 * A party balance: positive = the party owes the agency (due, receivable),
 * negative = the agency owes the party (advance / payable).
 */
export function BalanceAmount({
  value,
  dueLabel = "Due",
  advanceLabel = "Advance",
}: {
  value: string | number | null | undefined;
  dueLabel?: string;
  advanceLabel?: string;
}) {
  const d = new Decimal(value ?? 0);
  if (d.isZero()) return <Typography.Text type="secondary">0.00</Typography.Text>;
  const due = d.isPositive();
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      <Typography.Text type={due ? "danger" : "success"}>{formatMoney(d.abs())}</Typography.Text>{" "}
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {due ? dueLabel : advanceLabel}
      </Typography.Text>
    </span>
  );
}

/** Labels for the two balance directions, per party list. */
export const BALANCE_LABELS: Record<string, { due: string; advance: string }> = {
  clients: { due: "Due", advance: "Advance" },
  combinedclients: { due: "Receivable", advance: "Payable" },
  vendors: { due: "Advance paid", advance: "Payable" },
  agents: { due: "Receivable", advance: "Payable" },
};
