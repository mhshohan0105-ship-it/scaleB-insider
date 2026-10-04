import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { formatDate, formatMoney } from "./format";

describe("formatMoney", () => {
  it.each([
    ["0", "0.00"],
    ["5", "5.00"],
    ["999.999", "1,000.00"],
    ["1234567.5", "12,34,567.50"],
    ["100000", "1,00,000.00"],
    ["123456789012.34", "1,23,45,67,89,012.34"],
    ["-50000.005", "-50,000.01"],
    ["-0.001", "0.00"],
  ])("%s -> %s", (input, expected) => {
    expect(formatMoney(input)).toBe(expected);
  });

  it("accepts Decimal and a currency prefix", () => {
    expect(formatMoney(new Decimal("47000"), "BDT")).toBe("BDT 47,000.00");
  });

  it("does not lose precision on large values", () => {
    expect(formatMoney("99999999999999.99")).toBe("9,99,99,99,99,99,999.99");
  });
});

describe("formatDate", () => {
  it("displays UTC instants in Dhaka time (UTC+6)", () => {
    // 20:30 UTC on 31 Dec is already 1 Jan in Dhaka.
    expect(formatDate("2025-12-31T20:30:00Z")).toMatch(/01 Jan 2026/);
  });
});
