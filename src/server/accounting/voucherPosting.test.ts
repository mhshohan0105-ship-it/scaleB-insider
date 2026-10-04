import { describe, expect, it } from "vitest";
import { loanSchedule } from "@/lib/calc/loan";
import { calcPayroll } from "@/lib/calc/payroll";
import { validateLines } from "./validate";
import { voucherLines, type VoucherPostingInput } from "./voucherPosting";

const acc = new Proxy({} as Record<string, string>, { get: (_, k) => String(k) }) as never;

function view(v: VoucherPostingInput) {
  const lines = voucherLines(v, acc);
  expect(() => validateLines(lines)).not.toThrow();
  return lines.map((l) => [
    l.ledgerAccountId ?? `money:${l.moneyAccountId}`,
    String(l.debit ?? ""),
    String(l.credit ?? ""),
    l.partyId ?? "",
  ]);
}

describe("voucherLines", () => {
  it("expense goes to its head, paid from the money account", () => {
    expect(
      view({ kind: "EXPENSE", amount: "2000", moneyAccountId: "cash", expenseLedgerId: "rent" }),
    ).toEqual([
      ["rent", "2000", "", ""],
      ["money:cash", "", "2000", ""],
    ]);
  });

  it("incentive income is received in cash or kept by the vendor", () => {
    expect(view({ kind: "INCENTIVE_INCOME", amount: "5000", moneyAccountId: "bank" })).toEqual([
      ["money:bank", "5000", "", ""],
      ["INCENTIVE_INCOME", "", "5000", ""],
    ]);
    expect(
      view({ kind: "INCENTIVE_INCOME", amount: "5000", partyType: "VENDOR", partyId: "v1" }),
    ).toEqual([
      ["AP", "5000", "", "v1"],
      ["INCENTIVE_INCOME", "", "5000", ""],
    ]);
  });

  it("agent payment and employee advance hit the party", () => {
    expect(
      view({
        kind: "AGENT_PAYMENT",
        amount: "700",
        moneyAccountId: "cash",
        partyType: "AGENT",
        partyId: "a1",
      }),
    ).toEqual([
      ["AGENT_PAYABLE", "700", "", "a1"],
      ["money:cash", "", "700", ""],
    ]);
    expect(() =>
      voucherLines(
        {
          kind: "EMPLOYEE_ADVANCE",
          amount: "1",
          moneyAccountId: "c",
          partyType: "AGENT",
          partyId: "x",
        },
        acc,
      ),
    ).toThrow(/employee/);
  });

  it("investment return books the gain as income", () => {
    expect(
      view({ kind: "INVESTMENT_RETURN", amount: "100000", profit: "8000", moneyAccountId: "bank" }),
    ).toEqual([
      ["money:bank", "108000", "", ""],
      ["INVESTMENTS", "", "100000", ""],
      ["INTEREST_INCOME", "", "8000", ""],
    ]);
  });

  it("bill adjustment moves the party's due the right way", () => {
    const adj = (
      partyType: "CLIENT" | "VENDOR" | "AGENT",
      direction: "INCREASE_DUE" | "DECREASE_DUE",
    ) => view({ kind: "BILL_ADJUSTMENT", amount: "300", partyType, partyId: "p", direction });
    expect(adj("CLIENT", "INCREASE_DUE")).toEqual([
      ["AR", "300", "", "p"],
      ["BILL_ADJUSTMENT", "", "300", ""],
    ]);
    expect(adj("CLIENT", "DECREASE_DUE")[1]).toEqual(["AR", "", "300", "p"]);
    expect(adj("VENDOR", "INCREASE_DUE")[1]).toEqual(["AP", "", "300", "p"]);
    expect(adj("AGENT", "DECREASE_DUE")[0]).toEqual(["AGENT_PAYABLE", "300", "", "p"]);
  });

  it("set-off lowers the vendor side's payable and the client side's receivable", () => {
    expect(
      view({ kind: "SET_OFF", amount: "30000", setOff: { clientId: "cl", vendorId: "vn" } }),
    ).toEqual([
      ["AP", "30000", "", "vn"],
      ["AR", "", "30000", "cl"],
    ]);
    const lines = voucherLines(
      { kind: "SET_OFF", amount: "1", setOff: { clientId: "cl", vendorId: "vn" } },
      acc,
    );
    expect(lines.map((l) => l.partyType)).toEqual(["VENDOR", "CLIENT"]);
    expect(() => voucherLines({ kind: "SET_OFF", amount: "5" }, acc)).toThrow(/Linked/);
  });

  it("refuses zero amounts and missing money accounts", () => {
    expect(() =>
      voucherLines({ kind: "INVESTMENT", amount: "0", moneyAccountId: "c" }, acc),
    ).toThrow();
    expect(() => voucherLines({ kind: "NON_INVOICE_INCOME", amount: "5" }, acc)).toThrow(
      /Money account/,
    );
  });
});

describe("calcPayroll", () => {
  it("nets allowances, deductions and advance", () => {
    const r = calcPayroll({
      basic: "25000",
      allowances: [{ amount: "3000" }, { amount: "1500.50" }],
      deductions: [{ amount: "500" }],
      advanceAdjusted: "4000",
      advanceOutstanding: "10000",
    });
    expect(r.salaryExpense.toFixed(2)).toBe("29000.50");
    expect(r.netPaid.toFixed(2)).toBe("25000.50");
    expect(r.errors).toEqual([]);
  });

  it("cannot recover more advance than is outstanding", () => {
    const r = calcPayroll({
      basic: "20000",
      allowances: [],
      deductions: [],
      advanceAdjusted: "5000",
      advanceOutstanding: "3000",
    });
    expect(r.errors).toEqual(["Only 3000.00 of advance is outstanding"]);
  });
});

describe("loanSchedule", () => {
  it("equal installments on a reducing balance end at zero", () => {
    const rows = loanSchedule("120000", "12", 12, "2026-09");
    expect(rows).toHaveLength(12);
    expect(rows[0]).toMatchObject({ month: "2026-10" });
    expect(rows[0]!.installment.toFixed(2)).toBe("10661.85");
    expect(rows[0]!.interest.toFixed(2)).toBe("1200.00");
    expect(rows[11]!.month).toBe("2027-09");
    expect(rows[11]!.balance.toFixed(2)).toBe("0.00");
    const principal = rows.reduce((s, r) => s + Number(r.principal.toFixed(2)), 0);
    expect(principal.toFixed(2)).toBe("120000.00");
  });

  it("no interest splits the principal evenly", () => {
    const rows = loanSchedule("10000", "0", 3, "2026-12");
    expect(rows.map((r) => r.installment.toFixed(2))).toEqual(["3333.33", "3333.33", "3333.34"]);
    expect(rows[0]!.month).toBe("2027-01");
  });
});
