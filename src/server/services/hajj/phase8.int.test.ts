// Phase 8: pilgrims, Hajj invoices, registration, transfers, cancellation.
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import { tenantDb } from "@/server/db/tenant";
import { checkLedgerIntegrity } from "@/server/accounting/balances";
import { saveMaster } from "@/server/services/masters/masterService";
import { chartOfAccounts } from "@/server/services/accounts/moneyAccountService";
import { createItemInvoice, getItemInvoice } from "@/server/services/invoices/itemInvoiceService";
import { createRefund, refundTarget } from "@/server/services/refund/postRefund";
import { makeAgency } from "@/tests/integration/helpers";
import {
  cancelPilgrim,
  createPilgrim,
  getPilgrim,
  listPilgrims,
  registerPilgrim,
} from "./pilgrimService";
import { createTransfer, createTransferIn, listTransfers, voidTransfer } from "./transferService";

let A: Awaited<ReturnType<typeof makeAgency>>;
let clientId: string;
let vendorId: string;
let groupA: string;
let groupB: string;
const today = "2026-09-29";
const params = { page: 1, pageSize: 20, q: "", status: "active" } as never;

const pilgrim = (name: string, trackingNo: string) =>
  createPilgrim(
    A.ctx,
    {
      clientId,
      hajjYear: 2027,
      name,
      passportNo: `P${trackingNo}`,
      trackingNo,
      groupId: groupA,
      moallem: "Moallem 10",
    },
    today,
  ).then((r) => r.id);

const clientBalance = async () =>
  (await prisma.client.findUniqueOrThrow({ where: { id: clientId } })).balance.toFixed(2);

beforeAll(async () => {
  A = await makeAgency("ph8");
  clientId = (
    await saveMaster(A.ctx, "clients", null, {
      name: "Hajj Family Head",
      type: "INDIVIDUAL",
      creditLimit: "0",
      openingBalance: "0",
      openingBalanceType: "RECEIVABLE",
    })
  ).id;
  vendorId = (
    await saveMaster(A.ctx, "vendors", null, {
      name: "Hajj Operator",
      type: "OTHER",
      commissionPercent: "0",
      openingBalance: "0",
      openingBalanceType: "PAYABLE",
    })
  ).id;
  groupA = (
    await saveMaster(A.ctx, "groups", null, { name: "Hajj 2027 A", type: "HAJJ", year: 2027 })
  ).id;
  groupB = (
    await saveMaster(A.ctx, "groups", null, { name: "Hajj 2027 B", type: "HAJJ", year: 2027 })
  ).id;
});

describe("pilgrims and Hajj invoices", () => {
  let p1: string;
  let p2: string;

  it("adds pilgrims and refuses a duplicate tracking number", async () => {
    p1 = await pilgrim("karim uddin", "T1001");
    p2 = await pilgrim("rahima begum", "T1002");
    await expect(pilgrim("Someone Else", "T1001")).rejects.toThrow(/already used by KARIM UDDIN/);
    const list = await listPilgrims(A.ctx, { ...(params as object), q: "T100" } as never);
    expect(list.total).toBe(2);
    expect(list.counts.PRE_REGISTERED).toBe(2);
  });

  it("pre registration and Hajj invoices bill each pilgrim once", async () => {
    const pre = await createItemInvoice(A.ctx, "HAJJ_PRE_REG", {
      clientId,
      date: today,
      items: [
        {
          pilgrimId: p1,
          description: "Pre registration fee",
          qty: "1",
          unitPrice: "37000",
          unitCost: "36500",
          vendorId,
        },
        {
          pilgrimId: p2,
          description: "Pre registration fee",
          qty: "1",
          unitPrice: "37000",
          unitCost: "36500",
          vendorId,
        },
      ],
      post: true,
    });
    expect(pre.number).toMatch(/^HPR-2026-\d{5}$/);
    const inv = (await getItemInvoice(A.ctx, "HAJJ_PRE_REG", pre.id))!;
    expect(inv.items.map((i) => [i.passengerName, i.kind, i.group])).toEqual([
      ["KARIM UDDIN", "PILGRIM", "Hajj 2027 A"],
      ["RAHIMA BEGUM", "PILGRIM", "Hajj 2027 A"],
    ]);

    await expect(
      createItemInvoice(A.ctx, "HAJJ", {
        clientId,
        date: today,
        items: [
          { pilgrimId: p1, description: "Package", qty: "1", unitPrice: "1", vendorId },
          { pilgrimId: p1, description: "Package", qty: "1", unitPrice: "1", vendorId },
        ],
      }),
    ).rejects.toThrow(/Check the pilgrims/);

    await createItemInvoice(A.ctx, "HAJJ", {
      clientId,
      date: today,
      items: [
        {
          pilgrimId: p1,
          description: "Economy package",
          qty: "1",
          unitPrice: "620000",
          unitCost: "590000",
          vendorId,
        },
      ],
      post: true,
    });
    const chart = new Map((await chartOfAccounts(A.ctx)).map((l) => [l.name, l.balance]));
    expect(chart.get("Sales - Hajj")).toBe("694000.00");
    expect(chart.get("Cost of Sales - Hajj")).toBe("663000.00");
    expect(await clientBalance()).toBe("694000.00");
    const view = (await getPilgrim(A.ctx, p1))!;
    expect(view.invoiceLines).toHaveLength(2);
  });

  it("registers, then allows only the registration cancel", async () => {
    await registerPilgrim(A.ctx, p1, { regNo: "reg-77", regDate: today, voucherNo: "v-1" });
    const p = (await getPilgrim(A.ctx, p1))!;
    expect(p).toMatchObject({ status: "REGISTERED", regNo: "REG-77", voucherNo: "V-1" });
    await expect(registerPilgrim(A.ctx, p1, { regNo: "X", regDate: today })).rejects.toThrow(
      /already registered/,
    );
    await expect(
      cancelPilgrim(A.ctx, "PRE_REG", { pilgrimId: p1, date: today, reason: "test" }),
    ).rejects.toThrow(/already registered/);
  });

  it("moallem and group transfers bill a charge and can be voided", async () => {
    const before = await clientBalance();
    const { id, number } = await createTransfer(A.ctx, "MOALLEM", {
      pilgrimIds: [p1, p2],
      moallem: "Moallem 22",
      date: today,
      chargePerPilgrim: "500",
    });
    expect(number).toMatch(/^HTR-2026-\d{5}$/);
    expect((await getPilgrim(A.ctx, p2))!.moallem).toBe("Moallem 22");
    expect(await clientBalance()).toBe((Number(before) + 1000).toFixed(2));

    await createTransfer(A.ctx, "GROUP", { pilgrimIds: [p2], groupId: groupB, date: today });
    expect((await getPilgrim(A.ctx, p2))!.group?.name).toBe("Hajj 2027 B");
    await expect(
      createTransfer(A.ctx, "GROUP", { pilgrimIds: [p2], groupId: groupB, date: today }),
    ).rejects.toThrow(/already with/);

    await voidTransfer(A.ctx, id, { reason: "Wrong moallem" }, today);
    expect((await getPilgrim(A.ctx, p1))!.moallem).toBe("Moallem 10");
    expect(await clientBalance()).toBe(before);
    const history = (await getPilgrim(A.ctx, p1))!.events.map((e) => e.type);
    expect(history).toContain("TRANSFER_VOIDED");
    const list = await listTransfers(A.ctx, "GROUP", params);
    expect(list.rows[0]!.pilgrims[0]).toMatchObject({ name: "RAHIMA BEGUM", from: "Hajj 2027 A" });
  });

  it("cancel of pre registration points to the invoices to refund", async () => {
    const { invoices } = await cancelPilgrim(A.ctx, "PRE_REG", {
      pilgrimId: p2,
      date: today,
      reason: "Health reasons",
    });
    expect(invoices.map((i) => i.type)).toEqual(["HAJJ_PRE_REG"]);
    await expect(
      createTransfer(A.ctx, "MOALLEM", { pilgrimIds: [p2], moallem: "M", date: today }),
    ).rejects.toThrow(/cancelled/);

    // Refund the cancelled pilgrim's line only, keeping 1,000 as charge.
    const target = (await refundTarget(A.ctx, "OTHER_PACKAGE_HAJJ", invoices[0]!.id))!;
    const line = target.lines.find((l) => l.description.startsWith("RAHIMA"))!;
    await createRefund(A.ctx, "OTHER_PACKAGE_HAJJ", {
      invoiceId: invoices[0]!.id,
      date: today,
      clientCharge: "1000",
      method: "ADJUST_TO_BALANCE",
      lines: [{ lineId: line.lineId }],
    });
    // 694,000 invoiced (the voided moallem charge is gone) - 36,000 credit (37,000 - 1,000 kept).
    expect(await clientBalance()).toBe("658000.00");
  });

  it("transfer in creates pilgrims; transfer out and void restore status", async () => {
    const { pilgrimIds } = await createTransferIn(A.ctx, {
      agency: "Other Hajj Agency",
      clientId,
      hajjYear: 2027,
      groupId: groupA,
      date: today,
      pilgrims: [{ name: "abdul hai", trackingNo: "T2001", regNo: "R-9" }],
    });
    const incoming = (await getPilgrim(A.ctx, pilgrimIds[0]!))!;
    expect(incoming).toMatchObject({
      status: "TRANSFERRED_IN",
      transferredFrom: "Other Hajj Agency",
    });
    await expect(
      registerPilgrim(A.ctx, incoming.id, { regNo: "R-10", regDate: today }),
    ).rejects.toThrow(/already registered/);

    const out = await createTransfer(A.ctx, "OUT", {
      pilgrimIds: [incoming.id],
      agency: "Third Agency",
      date: today,
    });
    expect((await getPilgrim(A.ctx, incoming.id))!.status).toBe("TRANSFERRED_OUT");
    await voidTransfer(A.ctx, out.id, { reason: "Changed mind" }, today);
    expect((await getPilgrim(A.ctx, incoming.id))!.status).toBe("TRANSFERRED_IN");
  });

  it("keeps the ledger balanced", async () => {
    const integrity = await checkLedgerIntegrity(tenantDb(A.agency.id), A.agency.id);
    expect(integrity.drift).toEqual([]);
    expect(integrity.unbalancedEntries).toEqual([]);
    expect(integrity.totalDebit).toBe(integrity.totalCredit);
  });
});
