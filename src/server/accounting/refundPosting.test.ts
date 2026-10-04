import { describe, expect, it } from "vitest";
import { calcReissueLine } from "@/lib/calc/reissue";
import { calcRefund, cashReturnable, refundErrors, refundLineErrors } from "@/lib/calc/refund";
import { refundJournalLines, type RefundPostingInput } from "./refundPosting";
import { validateLines } from "./validate";

const accounts = new Proxy({} as Record<string, string>, { get: (_, k) => String(k) });

/** Net effect per account (+ debit, - credit), party appended when present. */
function net(lines: ReturnType<typeof refundJournalLines>) {
  const out: Record<string, string> = {};
  for (const l of lines) {
    const key = `${l.ledgerAccountId ?? `money:${l.moneyAccountId}`}${l.partyId ? `:${l.partyId}` : ""}`;
    const v = Number(String(l.debit ?? 0)) - Number(String(l.credit ?? 0));
    out[key] = String((Number(out[key] ?? 0) + v).toFixed(2));
  }
  return out;
}

function post(opts: Partial<RefundPostingInput> & Pick<RefundPostingInput, "lines">) {
  const lines = refundJournalLines(
    {
      invoiceType: "AIR",
      clientId: "client-1",
      clientRefundAmount: "0",
      clientCharge: "0",
      returnAmount: "0",
      moneyAccountId: null,
      ...opts,
    },
    accounts as never,
  );
  expect(() => validateLines(lines)).not.toThrow();
  return lines;
}

describe("calcReissueLine", () => {
  it("charges penalty + fare difference + service charge; profit is the service charge", () => {
    const r = calcReissueLine({ penalty: "3000", fareDifference: "4500.50", serviceCharge: "500" });
    expect(r.clientPrice.toFixed(2)).toBe("8000.50");
    expect(r.purchasePrice.toFixed(2)).toBe("7500.50");
    expect(r.profit.toFixed(2)).toBe("500.00");
  });
});

describe("refund calculation", () => {
  it("full refund: client credit and vendor credit net of charges", () => {
    // Ticket sold 49,500, bought 47,350. Client pays 2,000 charge; airline keeps 1,500.
    const t = calcRefund(
      [{ clientAmount: "49500", vendorAmount: "47350", vendorCharge: "1500" }],
      "2000",
    );
    expect(t.clientCredit.toFixed(2)).toBe("47500.00");
    expect(t.vendorCredit.toFixed(2)).toBe("45850.00");
    expect(t.profitEffect.toFixed(2)).toBe("-1650.00"); // original profit 2,150 → 500 kept
    expect(refundErrors(t, null)).toEqual([]);
  });

  it("partial refund checks what is left on the line", () => {
    const limits = { clientLeft: "10000", vendorLeft: "9000" };
    expect(
      refundLineErrors({ clientAmount: "4000", vendorAmount: "3500", vendorCharge: "0" }, limits),
    ).toEqual([]);
    expect(
      refundLineErrors({ clientAmount: "10000.01", vendorAmount: "0", vendorCharge: "0" }, limits),
    ).toEqual(["Client amount is more than the 10000.00 left to refund"]);
    expect(
      refundLineErrors({ clientAmount: "100", vendorAmount: "50", vendorCharge: "60" }, limits),
    ).toEqual(["Vendor charge cannot exceed the vendor amount"]);
    expect(
      refundLineErrors({ clientAmount: "0", vendorAmount: "0", vendorCharge: "0" }, limits),
    ).toEqual(["Nothing to refund on this line"]);
  });

  it("client charge cannot exceed the refund", () => {
    const t = calcRefund([{ clientAmount: "1000", vendorAmount: "0", vendorCharge: "0" }], "1200");
    expect(refundErrors(t, null)).toEqual(["Client charge cannot exceed the amount refunded"]);
  });

  it("cash return is limited to the client's credit after the refund", () => {
    // Invoice 10,000, client paid 6,000 → owes 4,000. Refund credit 9,500 → 5,500 advance.
    expect(cashReturnable("4000", "9500").toFixed(2)).toBe("5500.00");
    // Fully paid: all of the credit can go back.
    expect(cashReturnable("0", "9500").toFixed(2)).toBe("9500.00");
    // Nothing paid: nothing to give back.
    expect(cashReturnable("10000", "9500").toFixed(2)).toBe("0.00");
    const t = calcRefund([{ clientAmount: "10000", vendorAmount: "0", vendorCharge: "0" }], "500");
    expect(refundErrors(t, { returnAmount: "5500", available: "5500" })).toEqual([]);
    expect(refundErrors(t, { returnAmount: "6000", available: "5500" })[0]).toMatch(
      /only has 5500.00 in credit/,
    );
  });
});

describe("refundJournalLines", () => {
  it("full refund, adjusted to balance", () => {
    const lines = post({
      clientRefundAmount: "49500",
      clientCharge: "2000",
      lines: [{ vendorId: "vendor-a", vendorAmount: "47350", vendorCharge: "1500" }],
    });
    expect(net(lines)).toEqual({
      SALES_AIR: "49500.00",
      "AR:client-1": "-47500.00",
      REFUND_CHARGE_INCOME: "-2000.00",
      "AP:vendor-a": "45850.00",
      COGS_AIR: "-47350.00",
      REFUND_CHARGE_EXPENSE: "1500.00",
    });
  });

  it("partial refund with cash return pays the client from the money account", () => {
    const lines = post({
      invoiceType: "TOUR",
      clientRefundAmount: "10000",
      clientCharge: "500",
      returnAmount: "5500",
      moneyAccountId: "cash",
      lines: [
        { vendorId: "hotel", vendorAmount: "6000", vendorCharge: "0" },
        { vendorId: "hotel", vendorAmount: "2000", vendorCharge: "200" },
        { vendorId: null, vendorAmount: "0", vendorCharge: "0" },
      ],
    });
    expect(net(lines)).toEqual({
      SALES_TOUR: "10000.00",
      "AR:client-1": "-4000.00", // -10,000 + 500 charge + 5,500 paid back
      REFUND_CHARGE_INCOME: "-500.00",
      "AP:hotel": "7800.00",
      COGS_TOUR: "-8000.00",
      REFUND_CHARGE_EXPENSE: "200.00",
      "money:cash": "-5500.00",
    });
  });

  it("refuses a vendor amount without a vendor", () => {
    expect(() =>
      refundJournalLines(
        {
          invoiceType: "OTHER",
          clientId: "c",
          clientRefundAmount: "100",
          clientCharge: "0",
          returnAmount: "0",
          moneyAccountId: null,
          lines: [{ vendorId: null, vendorAmount: "50", vendorCharge: "0" }],
        },
        accounts as never,
      ),
    ).toThrow();
  });
});

describe("refund types", () => {
  it("send every invoice type to one whole-line refund type", async () => {
    const { refundTypeFor, REFUND_TYPE_INFO } = await import("@/lib/refundTypes");
    expect(refundTypeFor("AIR")).toBe("AIR");
    expect(refundTypeFor("REISSUE")).toBe("AIR");
    expect(refundTypeFor("VISA")).toBe("OTHER");
    expect(refundTypeFor("TOUR")).toBe("TOUR");
    expect(refundTypeFor("UMRAH")).toBe("OTHER_PACKAGE_HAJJ");
    expect(REFUND_TYPE_INFO.PARTIAL.invoiceTypes).toHaveLength(10);
  });
});
