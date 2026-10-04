import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { AccountingError, netBy, reverseLines, validateLines } from "./validate";

const L = (debit: string | null, credit: string | null, extra: object = {}) => ({
  ledgerAccountId: "acc",
  debit,
  credit,
  ...extra,
});

describe("validateLines", () => {
  it("accepts a balanced entry and returns the total", () => {
    const r = validateLines([L("50000", null), L(null, "47000"), L(null, "3000")]);
    expect(r.total.toString()).toBe("50000");
    expect(r.lines).toHaveLength(3);
  });

  it("rejects unbalanced entries", () => {
    expect(() => validateLines([L("100", null), L(null, "99.99")])).toThrow(/must equal/);
  });

  it("rejects fewer than two lines", () => {
    expect(() => validateLines([L("100", null)])).toThrow(AccountingError);
    expect(() => validateLines([])).toThrow(AccountingError);
  });

  it("rejects a line with both sides, neither side, or zero", () => {
    expect(() => validateLines([L("10", "10"), L(null, "0")])).toThrow(
      /either a debit or a credit/,
    );
    expect(() => validateLines([L(null, null), L("0", null)])).toThrow(
      /either a debit or a credit/,
    );
  });

  it("rejects negatives, more than 2 decimals and non numbers", () => {
    expect(() => validateLines([L("-5", null), L(null, "-5")])).toThrow(/negative/);
    expect(() => validateLines([L("1.005", null), L(null, "1.005")])).toThrow(/2 decimals/);
    expect(() => validateLines([L("abc", null), L(null, "1")])).toThrow(/invalid amount/);
    expect(() => validateLines([L(null, null, { debit: Number.NaN }), L(null, "1")])).toThrow();
  });

  it("requires an account and complete party info", () => {
    expect(() => validateLines([{ debit: "1" }, L(null, "1")])).toThrow(/no account/);
    expect(() => validateLines([L("1", null, { partyType: "CLIENT" }), L(null, "1")])).toThrow(
      /party/,
    );
    expect(() => validateLines([{ moneyAccountId: "m1", debit: "1" }, L(null, "1")])).not.toThrow();
  });

  it("is exact with decimals that floats get wrong", () => {
    // 0.1 + 0.2 != 0.3 in binary floating point.
    expect(() => validateLines([L("0.1", null), L("0.2", null), L(null, "0.3")])).not.toThrow();
  });
});

describe("reverseLines and netBy", () => {
  it("reversal nets every account to zero", () => {
    const { lines } = validateLines([
      L("500", null, { ledgerAccountId: "cash" }),
      L(null, "500", { ledgerAccountId: "ar", partyType: "CLIENT", partyId: "c1" }),
    ]);
    const both = [...lines, ...reverseLines(lines)];
    const byAccount = netBy(both, (l) => l.ledgerAccountId ?? null);
    for (const v of byAccount.values()) expect(v.isZero()).toBe(true);
  });

  it("netBy sums debit minus credit per key", () => {
    const d = (n: string) => new Prisma.Decimal(n);
    const m = netBy(
      [
        { k: "a", debit: d("10"), credit: d("0") },
        { k: "a", debit: d("0"), credit: d("4") },
        { k: null, debit: d("99"), credit: d("0") },
      ],
      (l) => l.k,
    );
    expect(m.get("a")?.toString()).toBe("6");
    expect(m.size).toBe(1);
  });
});
