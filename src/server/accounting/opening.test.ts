import { describe, expect, it } from "vitest";
import { partyOpeningLines, signedOpening } from "./opening";
import { validateLines } from "./validate";

const base = {
  partyAccountId: "ar",
  equityAccountId: "eq",
  partyType: "CLIENT" as const,
  partyId: "c1",
};

describe("partyOpeningLines", () => {
  it("receivable debits the party and credits equity", () => {
    const lines = partyOpeningLines({ ...base, amount: "12500", type: "RECEIVABLE" });
    expect(lines).toMatchObject([
      { ledgerAccountId: "ar", partyId: "c1" },
      { ledgerAccountId: "eq" },
    ]);
    expect(String(lines[0]!.debit)).toBe("12500");
    expect(String(lines[1]!.credit)).toBe("12500");
    expect(() => validateLines(lines)).not.toThrow();
  });

  it("payable credits the party and debits equity", () => {
    const lines = partyOpeningLines({ ...base, amount: "3000", type: "PAYABLE" });
    expect(lines[0]).toMatchObject({ ledgerAccountId: "eq" });
    expect(lines[1]).toMatchObject({ ledgerAccountId: "ar", partyId: "c1" });
    expect(String(lines[1]!.credit)).toBe("3000");
    expect(() => validateLines(lines)).not.toThrow();
  });
});

describe("signedOpening", () => {
  it("is positive for receivables, negative for payables", () => {
    expect(signedOpening("1500.50", "RECEIVABLE").toString()).toBe("1500.5");
    expect(signedOpening("1500.50", "PAYABLE").toString()).toBe("-1500.5");
    expect(() => signedOpening("-1", "RECEIVABLE")).toThrow();
  });
});
