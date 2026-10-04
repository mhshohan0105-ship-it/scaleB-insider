import { describe, expect, it } from "vitest";
import { calcQuotation } from "./calc/quotation";
import { addMonthsIso, expiryState } from "./passport";

describe("passport expiry", () => {
  const today = "2026-09-30";
  it("expired on or before today", () => {
    expect(expiryState("2026-09-30", today)).toEqual({ state: "EXPIRED", days: 0 });
    expect(expiryState("2025-01-01", today).state).toBe("EXPIRED");
  });
  it("warns within 6 months", () => {
    expect(expiryState("2026-10-01", today)).toEqual({ state: "SOON", days: 1 });
    expect(expiryState("2027-03-29", today).state).toBe("SOON");
    expect(expiryState("2027-03-30", today).state).toBe("OK");
  });
  it("adds months, clamping to the month's end", () => {
    expect(addMonthsIso("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonthsIso("2026-09-30", 6)).toBe("2027-03-30");
    expect(addMonthsIso("2027-12-15", 1)).toBe("2028-01-15");
  });
});

describe("calcQuotation", () => {
  it("totals lines, discount and margin", () => {
    const t = calcQuotation(
      [
        { qty: "2", unitPrice: "45000", unitCost: "41000" },
        { qty: "1", unitPrice: "8500.50" },
      ],
      "1000",
    );
    expect(t.subtotal.toFixed(2)).toBe("98500.50");
    expect(t.netTotal.toFixed(2)).toBe("97500.50");
    expect(t.cost.toFixed(2)).toBe("82000.00");
    expect(t.margin.toFixed(2)).toBe("15500.50");
  });
});
