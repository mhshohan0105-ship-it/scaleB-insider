// Agency branding: logo / seal images, printed-document options, and the
// public invoice check behind the QR code.
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import { tenantDb } from "@/server/db/tenant";
import { createAirInvoice } from "@/server/services/invoices/airInvoiceService";
import { voidInvoice } from "@/server/services/invoices/invoiceCommon";
import {
  ensurePublicToken,
  getPublicInvoice,
  qrPng,
  verifyUrl,
} from "@/server/services/invoices/publicInvoice";
import { saveMaster } from "@/server/services/masters/masterService";
import { getProfile, saveProfile } from "@/server/services/settings/settingsService";
import { makeAgency } from "@/tests/integration/helpers";
import { getAgencyImage, removeAgencyImage, saveAgencyImage, sniffImage } from "./brandingService";

// Smallest valid PNG (1×1) and a JPEG header.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==",
  "base64",
);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46]);

let A: Awaited<ReturnType<typeof makeAgency>>;
let B: Awaited<ReturnType<typeof makeAgency>>;
let clientId: string;
let vendorId: string;
let airlineId: string;

beforeAll(async () => {
  A = await makeAgency("brand");
  B = await makeAgency("brand2");
  clientId = (
    await saveMaster(A.ctx, "clients", null, {
      name: "Karim Hossain",
      type: "INDIVIDUAL",
      creditLimit: "0",
      openingBalanceType: "RECEIVABLE",
      openingBalance: "0",
    })
  ).id;
  vendorId = (
    await saveMaster(A.ctx, "vendors", null, {
      name: "Sky Consolidators",
      type: "AIRLINE_CONSOLIDATOR",
      commissionPercent: "7",
      openingBalanceType: "PAYABLE",
      openingBalance: "0",
    })
  ).id;
  airlineId = (await tenantDb(A.agency.id).airline.findFirstOrThrow({ where: { iata: "EK" } })).id;
});

const ticket = (ticketNo: string) => ({
  ticketNo,
  airlineId,
  vendorId,
  passengerName: "MD KARIM HOSSAIN",
  passengerType: "ADT",
  route: "DAC-DXB",
  journeyDate: "2026-11-12",
  baseFare: "30000",
  taxes: [{ code: "BD", amount: "500" }],
  commissionPercent: "7",
  clientPrice: "32000",
});

describe("agency images", () => {
  it("recognises PNG and JPEG by their bytes only", () => {
    expect(sniffImage(PNG)).toBe("image/png");
    expect(sniffImage(JPEG)).toBe("image/jpeg");
    expect(sniffImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
  });

  it("stores, replaces and removes the logo, per agency", async () => {
    await expect(saveAgencyImage(A.ctx, "LOGO", Buffer.from("GIF89a....."))).rejects.toThrow(
      /PNG or JPG/,
    );
    await expect(saveAgencyImage(A.ctx, "LOGO", Buffer.alloc(1024 * 1024 + 1, 0x89))).rejects.toThrow(
      /1 MB/,
    );
    await saveAgencyImage(A.ctx, "LOGO", PNG);
    await saveAgencyImage(A.ctx, "LOGO", JPEG);
    const logo = await getAgencyImage(A.ctx, "LOGO");
    expect(logo?.mimeType).toBe("image/jpeg");
    expect(await getAgencyImage(B.ctx, "LOGO")).toBeNull(); // the other agency sees nothing
    expect((await getProfile(A.ctx)).images.LOGO).not.toBeNull();

    await removeAgencyImage(A.ctx, "LOGO");
    expect(await getAgencyImage(A.ctx, "LOGO")).toBeNull();
    const audits = await prisma.auditLog.count({
      where: { agencyId: A.agency.id, entity: "AgencyImage" },
    });
    expect(audits).toBe(3);
  });

  it("saves the printed-document options with the profile", async () => {
    await saveProfile(A.ctx, {
      name: "Brand Travels",
      facebook: "facebook.com/brand",
      pdf: { showQr: false, showStamp: true, showPassports: false, showPoweredBy: true },
    });
    const p = await getProfile(A.ctx);
    expect(p.facebook).toBe("facebook.com/brand");
    expect(p.pdf).toEqual({ showQr: false, showStamp: true, showPassports: false, showPoweredBy: true });
  });
});

describe("public invoice check", () => {
  it("gives every new invoice a token and shows only the essentials", async () => {
    const r = await createAirInvoice(A.ctx, {
      clientId,
      date: "2026-10-25",
      tickets: [ticket("1769990000001")],
      post: true,
    });
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: r.id } });
    expect(inv.publicToken).toMatch(/^[A-Za-z0-9_-]{20}$/);
    expect(await ensurePublicToken(A.ctx, r.id)).toBe(inv.publicToken);

    const pub = await getPublicInvoice(inv.publicToken!);
    expect(pub).toEqual({
      number: r.number,
      date: "2026-10-25",
      netTotal: "32000.00",
      paid: "0.00",
      due: "32000.00",
      status: "POSTED",
      agency: { name: "Brand Travels", phone: null, email: null, website: null },
    });
    expect(JSON.stringify(pub)).not.toContain("KARIM"); // no client or passenger data

    expect(verifyUrl(inv.publicToken!)).toMatch(new RegExp(`/verify/${inv.publicToken}$`));
    expect(sniffImage(await qrPng(verifyUrl(inv.publicToken!)))).toBe("image/png");

    await voidInvoice(A.ctx, r.id, { reason: "Test" });
    expect((await getPublicInvoice(inv.publicToken!))?.status).toBe("VOID");
  });

  it("gives older invoices a token on first print and hides drafts", async () => {
    const r = await createAirInvoice(A.ctx, {
      clientId,
      date: "2026-10-25",
      tickets: [ticket("1769990000002")],
      post: false,
    });
    await prisma.invoice.update({ where: { id: r.id }, data: { publicToken: null } });
    const token = await ensurePublicToken(A.ctx, r.id);
    expect(token).toMatch(/^[A-Za-z0-9_-]{20}$/);
    expect(await getPublicInvoice(token)).toBeNull(); // still a draft
    expect(await getPublicInvoice("not-a-real-token-at-all")).toBeNull();
    expect(await getPublicInvoice("x")).toBeNull();
  });
});
