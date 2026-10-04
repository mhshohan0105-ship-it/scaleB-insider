"use client";

import { InputNumber } from "antd";
import type { InputNumberProps } from "antd";

type MoneyInputProps = Omit<InputNumberProps<string>, "stringMode" | "value" | "onChange"> & {
  value?: string | null;
  onChange?: (value: string | null) => void;
  /** Decimal places (2 for money, 4 for rates). */
  precision?: number;
};

/**
 * Amount input that keeps the value as a decimal string (never a float).
 */
export function MoneyInput({ value, onChange, precision = 2, ...rest }: MoneyInputProps) {
  return (
    <InputNumber<string>
      stringMode
      min="0"
      precision={precision}
      style={{ width: "100%" }}
      value={value ?? null}
      onChange={(v) => onChange?.(v === null || v === "" ? null : String(v))}
      {...rest}
    />
  );
}
