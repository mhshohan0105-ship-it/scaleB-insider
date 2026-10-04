// Combined clients (decision 2026-09-30, option 2): receivable and payable stay
// separate in AR / AP; the profile, ledger and due report show the net; a
// set-off settles one against the other and the client's invoices.
import { beforeAll, describe, expect, it } from "vitest";
import { tenantDb } from "@/server/db/tenant";
import { checkLedgerIntegrity } from "@/server/accounting/balances";
import { dueAdvanceReport } from "@/server/reports/partyReports";
import { getItemInvoice, createItemInvoice } from "@/server/services/invoices/itemInvoiceService";
import { partyLedger } from "@/server/services/ledger/partyLedger";
import { getEntity, saveMaster } from "@/server/services/masters/masterService";
import { createVoucher } from "@/server/services/vouchers/voucherService";
import { makeAgency } from "@/tests/integration/helpers";
import { createSetOff, listSetOffs, setOffLimit, voidSetOff } from "./combinedService";

let A: Awaited<ReturnType<typeof makeAgency>>;
let combinedId: string;
let clientId: string;
let vendorId: string;
let saleId: string;
const day = "2026-09-30";

async function arAp() {
  const db = tenantDb(A.agency.id);
  const [c, v] = await Promise.all([
    db.client.findFirstOrThrow({ where: { id: clientId } }),
    db.vendor.findFirstOrThrow({ where: { id: vendorId } }),
  ]);
  return { client: c.balance.toFixed(2), vendor: v.balance.toFixed(2) };
}

beforeAll(async () => {
  A = await makeAgency("combined");
  combinedId = (
    await saveMaster(A.ctx, "combinedclients", null, {
      name: "Rupsha Partner Travels",
      contactPerson: "Sohel",
      phone: "01711000555",
      openingBalance: "0",
      openingBalanceType: "RECEIVABLE",
    })
  ).id;
  const row = (await getEntity(A.ctx, "combinedclients", combinedId))!;
  clientId = row.clientId as string;
  vendorId = row.vendorId as string;
});

describe("combined clients", () => {
  it("get a client and a vendor account of the same name", async () => {
    const db = tenantDb(A.agency.id);
    expect(clientId).toBeTruthy();
    expect(vendorId).toBeTruthy();
    expect((await db.client.findFirstOrThrow({ where: { id: clientId } })).name).toBe(
      "Rupsha Partner Travels",
    );
    expect((await db.vendor.findFirstOrThrow({ where: { id: vendorId } })).phone).toBe(
      "01711000555",
    );
    // One client account belongs to one combined client only.
    await expect(
      saveMaster(A.ctx, "combinedclients", null, {
        name: "Someone Else",
        clientId,
        openingBalance: "0",
        openingBalanceType: "RECEIVABLE",
      }),
    ).rejects.toThrow(/already exists/);
  });

  it("keep receivable in AR and payable in AP, and show the net", async () => {
    // We sell them 50,000 (cost 42,000 from another vendor) ...
    const other = (
      await saveMaster(A.ctx, "vendors", null, {
        name: "Airline Desk",
        type: "AIRLINE",
        commissionPercent: "0",
        openingBalance: "0",
        openingBalanceType: "PAYABLE",
      })
    ).id;
    saleId = (
      await createItemInvoice(A.ctx, "OTHER", {
        clientId,
        date: day,
        post: true,
        items: [
          {
            description: "Group fare",
            qty: "1",
            unitPrice: "50000",
            unitCost: "42000",
            vendorId: other,
          },
        ],
      })
    ).id;
    // ... and buy 30,000 of visa processing from them for another client.
    const walkIn = (
      await saveMaster(A.ctx, "clients", null, {
        name: "Walk In Buyer",
        type: "INDIVIDUAL",
        creditLimit: "0",
        openingBalance: "0",
        openingBalanceType: "RECEIVABLE",
      })
    ).id;
    await createItemInvoice(A.ctx, "OTHER", {
      clientId: walkIn,
      date: day,
      post: true,
      items: [
        {
          description: "Visa processing",
          qty: "1",
          unitPrice: "33000",
          unitCost: "30000",
          vendorId,
        },
      ],
    });

    expect(await arAp()).toEqual({ client: "50000.00", vendor: "-30000.00" });
    const row = (await getEntity(A.ctx, "combinedclients", combinedId))!;
    expect(row).toMatchObject({
      balance: "20000.00",
      ownBalance: "0.00",
      clientBalance: "50000.00",
      vendorBalance: "-30000.00",
    });

    const ledger = await partyLedger(A.ctx, {
      partyType: "COMBINED",
      partyId: combinedId,
      page: 1,
      pageSize: 50,
    });
    expect(ledger.rows.map((r) => r.side).sort()).toEqual(["CLIENT", "VENDOR"]);
    expect(ledger.closing).toBe("20000.00");

    const due = await dueAdvanceReport(A.ctx, {
      party: "combinedclients",
      show: "all",
      asOf: day,
    } as never);
    expect(due.rows.find((r) => r.name === "Rupsha Partner Travels")?.due).toBe("20000.00");
  });

  it("sets off up to the smaller side and settles the client's invoice", async () => {
    expect(await setOffLimit(A.ctx, combinedId)).toEqual({
      receivable: "50000.00",
      payable: "30000.00",
      max: "30000.00",
    });
    await expect(
      createSetOff(A.ctx, combinedId, { date: day, amount: "30000.01" }),
    ).rejects.toThrow(/At most 30000.00/);

    const { id, number } = await createSetOff(A.ctx, combinedId, {
      date: day,
      amount: "30000",
      note: "Visa bill against ticket bill",
    });
    expect(number).toMatch(/^SOF-2026-\d{5}$/);
    expect(await arAp()).toEqual({ client: "20000.00", vendor: "0.00" });
    const inv = (await getItemInvoice(A.ctx, "OTHER", saleId))!;
    expect(inv).toMatchObject({ paidAmount: "30000.00", status: "PARTIAL" });
    expect((await getEntity(A.ctx, "combinedclients", combinedId))!.balance).toBe("20000.00");

    const list = await listSetOffs(A.ctx, combinedId, { page: 1, pageSize: 20 } as never);
    expect(list.rows[0]).toMatchObject({ number, amount: "30000.00" });
    expect(list.rows[0]!.invoices).toHaveLength(1);

    // Nothing left on the payable side.
    await expect(createSetOff(A.ctx, combinedId, { date: day, amount: "1" })).rejects.toThrow(
      /Nothing to set off/,
    );
    // Not through the generic voucher form.
    await expect(createVoucher(A.ctx, "SET_OFF", { date: day, amount: "1" })).rejects.toThrow(
      /combined client's page/,
    );

    await voidSetOff(A.ctx, id, { reason: "Wrong amount" });
    expect(await arAp()).toEqual({ client: "50000.00", vendor: "-30000.00" });
    expect((await getItemInvoice(A.ctx, "OTHER", saleId))!.paidAmount).toBe("0.00");
    await expect(voidSetOff(A.ctx, id, { reason: "Again" })).rejects.toThrow(/already void/);
  });

  it("keeps the books balanced and the cached balances right", async () => {
    const integrity = await checkLedgerIntegrity(tenantDb(A.agency.id), A.agency.id);
    expect(integrity.drift).toEqual([]);
    expect(integrity.unbalancedEntries).toEqual([]);
  });
});
