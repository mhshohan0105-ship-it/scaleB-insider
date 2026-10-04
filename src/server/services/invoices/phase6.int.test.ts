// Phase 6: remaining invoice types post correctly and match hand calculations.
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import { tenantDb } from "@/server/db/tenant";
import { checkLedgerIntegrity } from "@/server/accounting/balances";
import { saveMaster } from "@/server/services/masters/masterService";
import {
  createMoneyAccount,
  chartOfAccounts,
} from "@/server/services/accounts/moneyAccountService";
import { createMoneyReceipt } from "@/server/services/payments/receiptService";
import { createAirInvoice, getAirInvoice } from "./airInvoiceService";
import { voidInvoice } from "./invoiceCommon";
import { createItemInvoice, getItemInvoice } from "./itemInvoiceService";
import {
  createVisaInvoice,
  getVisaInvoice,
  setVisaStatus,
  updateVisaInvoice,
  visaBoard,
  visaFormValues,
} from "./visaInvoiceService";
import { makeAgency } from "@/tests/integration/helpers";

let A: Awaited<ReturnType<typeof makeAgency>>;
let clientId: string;
let v1: string;
let v2: string;
let cash: string;
const day = "2026-09-20";

async function bal(model: "client" | "vendor", id: string) {
  const row =
    model === "client"
      ? await prisma.client.findUniqueOrThrow({ where: { id } })
      : await prisma.vendor.findUniqueOrThrow({ where: { id } });
  return row.balance.toFixed(2);
}

const vendor = (name: string) =>
  saveMaster(A.ctx, "vendors", null, {
    name,
    type: "OTHER",
    commissionPercent: "0",
    openingBalance: "0",
    openingBalanceType: "PAYABLE",
  }).then((r) => r.id);

beforeAll(async () => {
  A = await makeAgency("ph6");
  clientId = (
    await saveMaster(A.ctx, "clients", null, {
      name: "Phase Six Client",
      type: "INDIVIDUAL",
      creditLimit: "0",
      openingBalance: "0",
      openingBalanceType: "RECEIVABLE",
    })
  ).id;
  v1 = await vendor("Hotel Vendor");
  v2 = await vendor("Transport Vendor");
  cash = (await createMoneyAccount(A.ctx, { name: "Desk", kind: "CASH", openingBalance: "0" })).id;
});

describe("non commission ticket", () => {
  it("uses the purchase price as entered, with no commission or AIT", async () => {
    const airlineId = (
      await tenantDb(A.agency.id).airline.findFirstOrThrow({ where: { iata: "BS" } })
    ).id;
    const { id } = await createAirInvoice(
      A.ctx,
      {
        clientId,
        date: day,
        tickets: [
          {
            ticketNo: "7770000000001",
            airlineId,
            vendorId: v1,
            passengerName: "NC PAX",
            route: "DAC-CXB",
            journeyDate: "2026-10-01",
            baseFare: "5000",
            taxes: [{ code: "BD", amount: "700" }],
            purchasePrice: "5400",
            clientPrice: "6000",
          },
        ],
      },
      "NON_COMMISSION",
    );
    const inv = (await getAirInvoice(A.ctx, id, "NON_COMMISSION"))!;
    expect(inv.number).toMatch(/^NCI-2026-\d{5}$/);
    expect(inv.tickets[0]).toMatchObject({
      totalFare: "5700.00",
      commissionAmount: "0.00",
      aitAmount: "0.00",
      purchasePrice: "5400.00",
      profit: "600.00",
    });
    const chart = new Map((await chartOfAccounts(A.ctx)).map((l) => [l.name, l.balance]));
    expect(chart.get("Sales - Non Commission Ticket")).toBe("6000.00");
    expect(chart.get("Cost of Sales - Non Commission Ticket")).toBe("5400.00");
  });
});

describe("item invoices", () => {
  it("other: qty x price, cost to each line's vendor", async () => {
    const before = await bal("vendor", v2);
    const { id, number } = await createItemInvoice(A.ctx, "OTHER", {
      clientId,
      date: day,
      items: [
        {
          description: "Airport pickup",
          qty: "2",
          unitPrice: "1500",
          unitCost: "1200",
          vendorId: v2,
        },
        { description: "Document handling", qty: "1", unitPrice: "500", unitCost: "0" },
      ],
    });
    expect(number).toMatch(/^OTH-2026-\d{5}$/);
    const inv = (await getItemInvoice(A.ctx, "OTHER", id))!;
    expect([inv.subtotal, inv.totalCost, inv.profit]).toEqual(["3500.00", "2400.00", "1100.00"]);
    expect(await bal("vendor", v2)).toBe((Number(before) - 2400).toFixed(2));
  });

  it("requires a vendor for any cost and a price or cost on every line", async () => {
    await expect(
      createItemInvoice(A.ctx, "OTHER", {
        clientId,
        date: day,
        items: [{ description: "Mystery cost", qty: "1", unitPrice: "100", unitCost: "50" }],
      }),
    ).rejects.toThrow();
    await expect(
      createItemInvoice(A.ctx, "OTHER", {
        clientId,
        date: day,
        items: [{ description: "Nothing", qty: "1", unitPrice: "0", unitCost: "0" }],
      }),
    ).rejects.toThrow();
  });

  it("tour: package price plus itemised costs from the itinerary", async () => {
    const tourGroupId = (
      await saveMaster(A.ctx, "tourgroups", null, { name: "Cox's Bazar Family" })
    ).id;
    const h1 = await bal("vendor", v1);
    const h2 = await bal("vendor", v2);
    const { id } = await createItemInvoice(A.ctx, "TOUR", {
      clientId,
      date: day,
      tourGroupId,
      travelDate: "2026-11-10",
      returnDate: "2026-11-13",
      items: [
        {
          kind: "PACKAGE",
          description: "3 nights Cox's Bazar package",
          qty: "2",
          unitPrice: "45000",
          unitCost: "0",
        },
        {
          kind: "ACCOMMODATION",
          description: "Sea view room",
          qty: "3",
          unitPrice: "0",
          unitCost: "5000",
          vendorId: v1,
        },
        {
          kind: "TRANSPORT",
          description: "AC microbus",
          qty: "1",
          unitPrice: "0",
          unitCost: "8000",
          vendorId: v2,
        },
      ],
    });
    const inv = (await getItemInvoice(A.ctx, "TOUR", id))!;
    expect([inv.netTotal, inv.totalCost, inv.profit, inv.tourGroup?.name, inv.travelDate]).toEqual([
      "90000.00",
      "23000.00",
      "67000.00",
      "Cox's Bazar Family",
      "2026-11-10",
    ]);
    expect(await bal("vendor", v1)).toBe((Number(h1) - 15000).toFixed(2));
    expect(await bal("vendor", v2)).toBe((Number(h2) - 8000).toFixed(2));
  });

  it("umrah: one line per pilgrim with group and room type", async () => {
    const groupId = (
      await saveMaster(A.ctx, "groups", null, { name: "Umrah Dec 2026", type: "UMRAH" })
    ).id;
    const roomTypeId = (
      await tenantDb(A.agency.id).roomType.findFirstOrThrow({ where: { name: "Quad" } })
    ).id;
    const pilgrim = (name: string) => ({
      kind: "PILGRIM",
      description: "Umrah 14 days economy",
      passengerName: name,
      passportNo: "A01234567",
      groupId,
      roomTypeId,
      qty: "1",
      unitPrice: "145000",
      unitCost: "128000",
      vendorId: v1,
    });
    const { id } = await createItemInvoice(A.ctx, "UMRAH", {
      clientId,
      date: day,
      groupId,
      items: [pilgrim("PILGRIM ONE"), pilgrim("PILGRIM TWO")],
    });
    const inv = (await getItemInvoice(A.ctx, "UMRAH", id))!;
    expect(inv.items.map((i) => [i.passengerName, i.group, i.roomType])).toEqual([
      ["PILGRIM ONE", "Umrah Dec 2026", "Quad"],
      ["PILGRIM TWO", "Umrah Dec 2026", "Quad"],
    ]);
    expect([inv.netTotal, inv.profit]).toEqual(["290000.00", "34000.00"]);
    await expect(
      createItemInvoice(A.ctx, "UMRAH", {
        clientId,
        date: day,
        items: [{ ...pilgrim("X"), passengerName: "" }],
      }),
    ).rejects.toThrow();
  });
});

describe("visa invoice and processing", () => {
  it("tracks status per passenger and keeps it through edits", async () => {
    const visaTypeId = (
      await tenantDb(A.agency.id).visaType.findFirstOrThrow({ where: { name: "Tourist" } })
    ).id;
    const line = (name: string) => ({
      country: "Thailand",
      visaTypeId,
      passengerName: name,
      passportNo: "B7654321",
      vendorId: v2,
      clientPrice: "6500",
      purchasePrice: "5200",
    });
    const { id, number } = await createVisaInvoice(A.ctx, {
      clientId,
      date: day,
      lines: [line("VISA ONE"), line("VISA TWO")],
    });
    expect(number).toMatch(/^VIS-2026-\d{5}$/);
    let inv = (await getVisaInvoice(A.ctx, id))!;
    expect([inv.netTotal, inv.totalCost, inv.profit]).toEqual(["13000.00", "10400.00", "2600.00"]);
    const [first, second] = inv.lines;

    await setVisaStatus(A.ctx, first!.id, { status: "SUBMITTED" });
    await setVisaStatus(A.ctx, first!.id, { status: "APPROVED", note: "Approved in 5 days" });

    // Edit: change the second passenger's price, keep the first line's status.
    const values = visaFormValues(inv);
    values.lines[1] = { ...values.lines[1]!, clientPrice: "7000.00" };
    await updateVisaInvoice(A.ctx, id, { ...values, post: true });
    inv = (await getVisaInvoice(A.ctx, id))!;
    expect(inv.lines[0]).toMatchObject({ id: first!.id, status: "APPROVED" });
    expect(inv.lines[0]!.history.map((h) => h.status)).toEqual([
      "PENDING",
      "SUBMITTED",
      "APPROVED",
    ]);
    expect(inv.lines[1]).toMatchObject({
      id: second!.id,
      clientPrice: "7000.00",
      status: "PENDING",
    });
    expect(inv.netTotal).toBe("13500.00");

    await setVisaStatus(A.ctx, first!.id, { status: "DELIVERED" });
    inv = (await getVisaInvoice(A.ctx, id))!;
    expect(inv.lines[0]!.deliveryDate).not.toBeNull();

    const board = await visaBoard(A.ctx);
    expect(
      board
        .filter((c) => c.invoiceId === id)
        .map((c) => c.status)
        .sort(),
    ).toEqual(["DELIVERED", "PENDING"]);

    // Money receipts work for any invoice type.
    await createMoneyReceipt(A.ctx, {
      clientId,
      date: day,
      moneyAccountId: cash,
      paymentMethod: "CASH",
      amount: "1",
    });
    // Void removes the passengers from the board.
    const { id: other } = await createVisaInvoice(A.ctx, {
      clientId,
      date: day,
      lines: [line("VOID ME")],
    });
    await voidInvoice(A.ctx, other, { reason: "Duplicate" });
    expect((await visaBoard(A.ctx, "VOID ME")).length).toBe(0);
  });
});

describe("golden rule", () => {
  it("still holds after every invoice type", async () => {
    const integrity = await checkLedgerIntegrity(tenantDb(A.agency.id), A.agency.id);
    expect(integrity.drift).toEqual([]);
    expect(integrity.unbalancedEntries).toEqual([]);
    expect(integrity.totalDebit).toBe(integrity.totalCredit);
  });
});
