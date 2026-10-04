// Phase 10: passports (expiry, status history, scans) and quotations
// (totals, status, one-click conversion to a draft invoice).
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import { saveMaster } from "@/server/services/masters/masterService";
import { addAttachment, getAttachment } from "@/server/services/attachments/attachmentService";
import { getItemInvoice } from "@/server/services/invoices/itemInvoiceService";
import {
  changePassportStatus,
  getPassport,
  listPassports,
  passportAlerts,
  savePassport,
} from "@/server/services/passports/passportService";
import { makeAgency } from "@/tests/integration/helpers";
import {
  convertQuotation,
  getQuotation,
  listQuotations,
  saveQuotation,
  setQuotationStatus,
} from "./quotationService";

let A: Awaited<ReturnType<typeof makeAgency>>;
let clientId: string;
let vendorId: string;
const today = "2026-09-30";
const list = { page: 1, pageSize: 20, q: "", status: "active" } as never;

beforeAll(async () => {
  A = await makeAgency("ph10");
  clientId = (
    await saveMaster(A.ctx, "clients", null, {
      name: "P10 Client",
      type: "INDIVIDUAL",
      creditLimit: "0",
      openingBalance: "0",
      openingBalanceType: "RECEIVABLE",
    })
  ).id;
  vendorId = (
    await saveMaster(A.ctx, "vendors", null, {
      name: "P10 Hotel",
      type: "HOTEL",
      commissionPercent: "0",
      openingBalance: "0",
      openingBalanceType: "PAYABLE",
    })
  ).id;
});

describe("passports", () => {
  it("records, refuses duplicates, tracks status and expiry", async () => {
    const withUs = (await saveMaster(A.ctx, "passportstatus", null, { name: "With agency" })).id;
    const back = (await saveMaster(A.ctx, "passportstatus", null, { name: "Returned" })).id;
    const { id } = await savePassport(A.ctx, null, {
      passportNo: "a01234567",
      name: "karim uddin",
      clientId,
      expiryDate: "2027-01-15",
      statusId: withUs,
      receivedDate: today,
    });
    await savePassport(A.ctx, null, {
      passportNo: "B7654321",
      name: "Old One",
      expiryDate: "2026-05-01",
    });
    await savePassport(A.ctx, null, {
      passportNo: "C1111111",
      name: "Fine One",
      expiryDate: "2030-01-01",
    });
    await expect(
      savePassport(A.ctx, null, { passportNo: "A01234567", name: "X Y", expiryDate: "2030-01-01" }),
    ).rejects.toThrow(/already recorded/);

    await changePassportStatus(A.ctx, id, { statusId: back, note: "Collected by client" });
    const p = (await getPassport(A.ctx, id, today))!;
    expect(p).toMatchObject({ passportNo: "A01234567", name: "KARIM UDDIN", expiry: "SOON" });
    expect(p.statusHistory.map((h) => h.status)).toEqual(["With agency", "Returned"]);

    const soon = await listPassports(
      A.ctx,
      { ...(list as object), expiry: "SOON" } as never,
      today,
    );
    expect(soon.rows.map((r) => r.passportNo)).toEqual(["A01234567"]);
    const expired = await listPassports(
      A.ctx,
      { ...(list as object), expiry: "EXPIRED" } as never,
      today,
    );
    expect(expired.rows.map((r) => r.passportNo)).toEqual(["B7654321"]);
    const alerts = await passportAlerts(A.ctx, today);
    expect(alerts).toMatchObject({ expired: 1, soon: 1 });

    const scan = await addAttachment(
      A.ctx,
      { passportId: id },
      {
        name: "scan.png",
        type: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71]),
      },
    );
    const found = (await getAttachment(A.ctx, scan.id))!;
    expect(found.module).toBe("passport");
    await expect(
      addAttachment(
        A.ctx,
        { passportId: id },
        { name: "x.exe", type: "application/x-msdownload", bytes: new Uint8Array([1]) },
      ),
    ).rejects.toThrow(/PDF or an image/);
  });
});

describe("quotations", () => {
  let id: string;

  it("totals the lines and follows the status rules", async () => {
    const q = await saveQuotation(A.ctx, null, {
      clientId,
      date: today,
      validUntil: "2026-10-15",
      subject: "Cox's Bazar 3 nights",
      invoiceType: "TOUR",
      discount: "1000",
      lines: [
        {
          description: "Hotel, 3 nights",
          qty: "2",
          unitPrice: "12000",
          unitCost: "10000",
          vendorId,
        },
        { description: "Transport", qty: "1", unitPrice: "6000" },
      ],
    });
    id = q.id;
    expect(q.number).toMatch(/^QT-2026-\d{5}$/);
    const view = (await getQuotation(A.ctx, id, today))!;
    expect(view).toMatchObject({
      subtotal: "30000.00",
      netTotal: "29000.00",
      cost: "20000.00",
      margin: "9000.00",
      shownStatus: "DRAFT",
    });
    expect((await getQuotation(A.ctx, id, "2026-10-16"))!.shownStatus).toBe("EXPIRED");

    await setQuotationStatus(A.ctx, id, { status: "SENT" });
    await setQuotationStatus(A.ctx, id, { status: "ACCEPTED" });
    await expect(setQuotationStatus(A.ctx, id, { status: "SENT" })).rejects.toThrow(
      /cannot be marked/,
    );
    // Nothing is posted for a quotation.
    expect(
      await prisma.journalEntry.count({ where: { agencyId: A.agency.id, sourceId: id } }),
    ).toBe(0);
  });

  it("converts once to a draft invoice with the same lines", async () => {
    const r = await convertQuotation(A.ctx, id, today);
    expect(r.invoiceType).toBe("TOUR");
    const inv = (await getItemInvoice(A.ctx, "TOUR", r.invoiceId))!;
    expect(inv).toMatchObject({
      status: "DRAFT",
      subtotal: "30000.00",
      discount: "1000.00",
      netTotal: "29000.00",
      totalCost: "20000.00",
    });
    expect(inv.items.map((i) => [i.description, i.qty, i.vendor])).toEqual([
      ["Hotel, 3 nights", "2", "P10 Hotel"],
      ["Transport", "1", null],
    ]);
    await expect(convertQuotation(A.ctx, id, today)).rejects.toThrow(/converted/);
    await expect(
      saveQuotation(A.ctx, id, {
        clientId,
        date: today,
        validUntil: today,
        lines: [{ description: "x", qty: "1", unitPrice: "1" }],
      }),
    ).rejects.toThrow(/converted quotation cannot be edited/);
    const rows = (await listQuotations(A.ctx, list, today)).rows;
    expect(rows[0]).toMatchObject({ status: "CONVERTED", convertedInvoice: { id: r.invoiceId } });
  });
});
