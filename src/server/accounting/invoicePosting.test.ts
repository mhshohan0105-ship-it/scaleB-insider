import { describe, expect, it } from "vitest";
import { calcInvoiceTotals } from "@/lib/calc/invoiceTotals";
import { invoiceJournalLines } from "./invoicePosting";
import { validateLines } from "./validate";

const accounts = new Proxy({} as Record<string, string>, { get: (_, k) => String(k) });

function linesFor(opts: Parameters<typeof calcInvoiceTotals>[0] & { agentId?: string }) {
  const t = calcInvoiceTotals(opts);
  return invoiceJournalLines(
    {
      type: "AIR",
      clientId: "client-1",
      agentId: opts.agentId,
      ...t,
      costs: opts.lines.map((l, i) => ({
        vendorId: i % 2 ? "vendor-b" : "vendor-a",
        amount: l.purchasePrice,
      })),
    },
    accounts as never,
  );
}

describe("invoiceJournalLines", () => {
  it("matches the plan's example: client price 50,000, vendor cost 47,000", () => {
    const lines = linesFor({ lines: [{ clientPrice: "50000", purchasePrice: "47000" }] });
    const view = lines.map((l) => [
      l.ledgerAccountId,
      String(l.debit ?? ""),
      String(l.credit ?? ""),
      l.partyId ?? "",
    ]);
    expect(view).toEqual([
      ["AR", "50000", "", "client-1"],
      ["SALES_AIR", "", "50000", ""],
      ["COGS_AIR", "47000", "", ""],
      ["AP", "", "47000", "vendor-a"],
    ]);
    expect(() => validateLines(lines)).not.toThrow();
  });

  it("balances with discount, service charge, VAT, several vendors and agent commission", () => {
    const lines = linesFor({
      lines: [
        { clientPrice: "49500", purchasePrice: "47350" },
        { clientPrice: "30000", purchasePrice: "28000" },
        { clientPrice: "12000.50", purchasePrice: "11800.25" },
      ],
      discount: "500",
      serviceCharge: "1000",
      vat: "150",
      agentCommission: "300",
      agentId: "agent-1",
    });
    const { total } = validateLines(lines);
    // Debits: AR 92,150.50 + discount 500 + cost of sales 87,150.25 + agent commission 300.
    expect(total.toString()).toBe("180100.75");
    const ap = lines.filter((l) => l.ledgerAccountId === "AP");
    expect(ap.map((l) => [l.partyId, String(l.credit)])).toEqual([
      ["vendor-a", "59150.25"], // 47,350 + 11,800.25 combined
      ["vendor-b", "28000"],
    ]);
    expect(lines.find((l) => l.ledgerAccountId === "AGENT_PAYABLE")).toMatchObject({
      partyId: "agent-1",
    });
  });

  it("skips zero lines", () => {
    const lines = linesFor({ lines: [{ clientPrice: "100", purchasePrice: "0" }] });
    expect(lines.map((l) => l.ledgerAccountId)).toEqual(["AR", "SALES_AIR"]);
  });
});
