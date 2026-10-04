import { describe, expect, it } from "vitest";
import { amountInWords } from "../amountInWords";
import { allocationErrors, autoAllocate } from "./allocation";
import { calcAirTicket } from "./airTicket";
import { calcItemLine } from "./items";
import { calcInvoiceTotals, paymentState } from "./invoiceTotals";

const s = (v: { toFixed(n: number): string }) => v.toFixed(2);

describe("calcAirTicket", () => {
  const base = {
    baseFare: "40000",
    taxes: [
      { code: "BD", amount: "500" },
      { code: "UT", amount: "300" },
      { code: "YQ", amount: "9200" },
    ],
    commissionPercent: "7",
    commissionBase: "BASE_FARE" as const,
    aitRatePercent: "0.3",
    aitBase: "TOTAL_FARE" as const,
    clientPrice: "49500",
  };

  it("applies the default rule: 7% commission on base, 0.3% AIT on total", () => {
    const r = calcAirTicket(base);
    expect(s(r.taxTotal)).toBe("10000.00");
    expect(s(r.totalFare)).toBe("50000.00");
    expect(s(r.commissionAmount)).toBe("2800.00"); // 7% of 40,000
    expect(s(r.aitAmount)).toBe("150.00"); // 0.3% of 50,000
    expect(s(r.purchasePrice)).toBe("47350.00"); // 50,000 - 2,800 + 150
    expect(s(r.profit)).toBe("2150.00"); // 49,500 - 47,350
  });

  it("switches the bases", () => {
    const r = calcAirTicket({ ...base, commissionBase: "TOTAL_FARE", aitBase: "BASE_FARE" });
    expect(s(r.commissionAmount)).toBe("3500.00");
    expect(s(r.aitAmount)).toBe("120.00");
    expect(s(r.purchasePrice)).toBe("46620.00");
  });

  it("works with no commission, no AIT, no taxes, and can show a loss", () => {
    const r = calcAirTicket({
      ...base,
      taxes: [],
      commissionPercent: "0",
      aitRatePercent: "0",
      clientPrice: "39000",
    });
    expect(s(r.purchasePrice)).toBe("40000.00");
    expect(s(r.profit)).toBe("-1000.00");
  });

  it("rounds commission and AIT half up to paisa", () => {
    const r = calcAirTicket({ ...base, baseFare: "12345.67", taxes: [], clientPrice: "13000" });
    expect(s(r.commissionAmount)).toBe("864.20"); // 864.1969
    expect(s(r.aitAmount)).toBe("37.04"); // 37.03701
  });
});

describe("calcInvoiceTotals", () => {
  it("computes net, cost and profit", () => {
    const t = calcInvoiceTotals({
      lines: [
        { clientPrice: "49500", purchasePrice: "47350" },
        { clientPrice: "30000", purchasePrice: "28000" },
      ],
      discount: "500",
      serviceCharge: "1000",
      vat: "150",
      agentCommission: "300",
    });
    expect(s(t.subtotal)).toBe("79500.00");
    expect(s(t.netTotal)).toBe("80150.00"); // 79,500 - 500 + 1,000 + 150
    expect(s(t.totalCost)).toBe("75350.00");
    expect(s(t.profit)).toBe("4350.00"); // 80,150 - 150 - 75,350 - 300
  });
});

describe("paymentState", () => {
  it("is POSTED, PARTIAL or PAID", () => {
    expect(paymentState("1000", "0")).toBe("POSTED");
    expect(paymentState("1000", "999.99")).toBe("PARTIAL");
    expect(paymentState("1000", "1000")).toBe("PAID");
  });
});

describe("autoAllocate", () => {
  const dues = [
    { invoiceId: "b", date: "2026-09-10", number: "AIT-2026-00002", due: "5000" },
    { invoiceId: "a", date: "2026-09-01", number: "AIT-2026-00001", due: "3000" },
    { invoiceId: "c", date: "2026-09-20", number: "AIT-2026-00003", due: "4000" },
  ];

  it("pays oldest first and keeps the rest as advance", () => {
    const r = autoAllocate("10000", dues);
    expect(r.allocations.map((a) => [a.invoiceId, s(a.amount)])).toEqual([
      ["a", "3000.00"],
      ["b", "5000.00"],
      ["c", "2000.00"],
    ]);
    expect(s(r.advance)).toBe("0.00");
  });

  it("leaves an advance when the amount exceeds the dues", () => {
    const r = autoAllocate("15000", dues);
    expect(r.allocations).toHaveLength(3);
    expect(s(r.advance)).toBe("3000.00");
  });

  it("allocates nothing when there is nothing due", () => {
    expect(autoAllocate("500", []).allocations).toEqual([]);
  });
});

describe("allocationErrors", () => {
  const dues = [{ invoiceId: "a", date: "2026-09-01", number: "INV-1", due: "3000" }];

  it("accepts a valid split", () => {
    expect(allocationErrors("5000", [{ invoiceId: "a", amount: "3000" }], dues)).toEqual([]);
  });

  it("catches over-allocation, unknown invoices and totals above the amount", () => {
    expect(allocationErrors("5000", [{ invoiceId: "a", amount: "3000.01" }], dues)).toContain(
      "INV-1: allocation is more than its due",
    );
    expect(allocationErrors("5000", [{ invoiceId: "x", amount: "1" }], dues)).toHaveLength(1);
    expect(allocationErrors("100", [{ invoiceId: "a", amount: "200" }], dues)).toContain(
      "Allocations add up to more than the amount received",
    );
    expect(allocationErrors("100", [{ invoiceId: "a", amount: "0" }], dues)).toContain(
      "INV-1: allocation must be more than 0",
    );
  });
});

describe("amountInWords", () => {
  it.each([
    ["0", "Zero Taka Only"],
    ["5", "Five Taka Only"],
    ["125550.50", "One Lakh Twenty Five Thousand Five Hundred Fifty Taka and Fifty Paisa Only"],
    ["1000000", "Ten Lakh Taka Only"],
    [
      "23456789",
      "Two Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine Taka Only",
    ],
    ["1500000000", "One Hundred Fifty Crore Taka Only"],
    ["47350", "Forty Seven Thousand Three Hundred Fifty Taka Only"],
    ["0.05", "Zero Taka and Five Paisa Only"],
  ])("%s", (value, words) => {
    expect(amountInWords(value)).toBe(words);
  });
});

describe("calcItemLine", () => {
  it("multiplies quantity by unit price and cost", () => {
    const r = calcItemLine({ qty: "3", unitPrice: "4500", unitCost: "3800.50" });
    expect([s(r.clientPrice), s(r.purchasePrice), s(r.profit)]).toEqual([
      "13500.00",
      "11401.50",
      "2098.50",
    ]);
  });

  it("handles fractional quantities (nights, kg) and rounds to paisa", () => {
    const r = calcItemLine({ qty: "2.5", unitPrice: "1000.33", unitCost: "0" });
    expect(s(r.clientPrice)).toBe("2500.83"); // 2500.825 rounds half up
    expect(s(r.profit)).toBe("2500.83");
  });

  it("allows cost-only lines (tour costs under a package price)", () => {
    const r = calcItemLine({ qty: "4", unitPrice: "0", unitCost: "2500" });
    expect([s(r.clientPrice), s(r.purchasePrice), s(r.profit)]).toEqual([
      "0.00",
      "10000.00",
      "-10000.00",
    ]);
  });
});
