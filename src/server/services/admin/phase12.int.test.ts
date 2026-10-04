// Phase 12: SMS (log, events, reminders), notifications, feedback, global
// search, platform admin and impersonation.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_ROLES } from "@/lib/permissions";
import { prisma } from "@/server/db/prisma";
import { saveMaster } from "@/server/services/masters/masterService";
import {
  createVisaInvoice,
  getVisaInvoice,
  setVisaStatus,
} from "@/server/services/invoices/visaInvoiceService";
import { savePassport } from "@/server/services/passports/passportService";
import { verifyLogin } from "@/server/services/auth/login";
import { makeAgency } from "@/tests/integration/helpers";
import type { SmsProvider } from "@/server/sms/provider";
import {
  listSmsLogs,
  sendManualSms,
  sendPassportReminders,
  setSmsProviderForTests,
} from "../sms/smsService";
import { markRead, myNotifications } from "../notifications/notificationService";
import { listFeedback, replyFeedback, sendFeedback } from "../feedback/feedbackService";
import { globalSearch } from "../search/globalSearch";
import {
  consumeImpersonation,
  createAgency,
  listAgencies,
  setAgencyPlan,
  setAgencyStatus,
  startImpersonation,
} from "./adminService";

let A: Awaited<ReturnType<typeof makeAgency>>;
let clientId: string;
const sent: { to: string; text: string }[] = [];
let fail = false;
const fake: SmsProvider = {
  name: "fake",
  async send(to, text) {
    sent.push({ to, text });
    return fail
      ? { status: "FAILED", error: "gateway down" }
      : { status: "SENT", providerRef: "ok" };
  },
};
const list = { page: 1, pageSize: 20, q: "", status: "active" } as never;
const allPermissions = DEFAULT_ROLES.find((r) => r.name === "Owner")!.permissions;

beforeAll(async () => {
  A = await makeAgency("ph12");
  setSmsProviderForTests(fake);
  clientId = (
    await saveMaster(A.ctx, "clients", null, {
      name: "Phase Twelve Client",
      type: "INDIVIDUAL",
      phone: "01711000099",
      creditLimit: "0",
      openingBalance: "0",
      openingBalanceType: "RECEIVABLE",
    })
  ).id;
});

afterAll(() => setSmsProviderForTests(null));

describe("sms", () => {
  it("is refused while SMS is off", async () => {
    await expect(
      sendManualSms(A.ctx, { to: "01711000001", message: "Hello there" }),
    ).rejects.toThrow(/turned off/);
    await prisma.agencySetting.update({
      where: { agencyId: A.agency.id },
      data: { smsEnabled: true },
    });
  });

  it("sends by hand, checks the number, and logs", async () => {
    await expect(sendManualSms(A.ctx, { to: "029000001", message: "Hello there" })).rejects.toThrow(
      /mobile number/,
    );
    const r = await sendManualSms(A.ctx, { to: "01711 000001", message: "Hello there" });
    expect(r.status).toBe("SENT");
    expect(sent.at(-1)).toEqual({ to: "8801711000001", text: "Hello there" });
  });

  it("tells the client when a visa is approved, and the team in the app", async () => {
    const vendorId = (
      await saveMaster(A.ctx, "vendors", null, {
        name: "Embassy Agent",
        type: "VISA",
        commissionPercent: "0",
        openingBalance: "0",
        openingBalanceType: "PAYABLE",
      })
    ).id;
    const { id } = await createVisaInvoice(A.ctx, {
      clientId,
      date: "2026-09-30",
      post: true,
      lines: [
        {
          passengerName: "RAHIM",
          country: "Thailand",
          vendorId,
          clientPrice: "6500",
          purchasePrice: "5000",
        },
      ],
    });
    const line = (await getVisaInvoice(A.ctx, id))!.lines[0]!;
    await setVisaStatus(A.ctx, line.id, { status: "SUBMITTED" });
    await setVisaStatus(A.ctx, line.id, { status: "APPROVED" });
    expect(sent.at(-1)!.to).toBe("8801711000099");
    expect(sent.at(-1)!.text).toMatch(/Thailand visa for RAHIM has been approved/);
    const n = await myNotifications(A.ctx);
    expect(n.rows[0]).toMatchObject({ kind: "VISA_APPROVED", read: false });
    await markRead(A.ctx);
    expect((await myNotifications(A.ctx)).unread).toBe(0);
  });

  it("sends passport reminders once per 30 days; failures notify", async () => {
    await savePassport(A.ctx, null, {
      passportNo: "Z1234567",
      name: "Rahim",
      clientId,
      expiryDate: "2027-01-10",
    });
    await savePassport(A.ctx, null, {
      passportNo: "Z7654321",
      name: "No Phone",
      expiryDate: "2027-01-10",
    });
    expect(await sendPassportReminders(A.ctx, "2026-09-30")).toEqual({
      sent: 1,
      skipped: 1,
      considered: 2,
    });
    expect(await sendPassportReminders(A.ctx, "2026-09-30")).toMatchObject({
      sent: 0,
      considered: 1,
    });

    fail = true;
    await sendManualSms(A.ctx, { to: "01811000002", message: "Will fail" });
    fail = false;
    const logs = await listSmsLogs(A.ctx, list);
    expect(logs.counts).toMatchObject({ SENT: 3, FAILED: 1 });
    expect((await myNotifications(A.ctx)).rows[0]!.kind).toBe("SMS_FAILED");
  });
});

describe("feedback and search", () => {
  it("records feedback and a reply", async () => {
    const { id } = await sendFeedback(A.ctx, {
      kind: "IDEA",
      message: "Please add a Bangla invoice print",
    });
    await replyFeedback(A.ctx, id, { status: "DONE", reply: "Planned" });
    const rows = (await listFeedback(A.ctx, list, false)).rows;
    expect(rows[0]).toMatchObject({ status: "DONE", reply: "Planned" });
  });

  it("finds invoices by passenger, clients by phone; respects permissions", async () => {
    const hits = await globalSearch(A.ctx, allPermissions, "rahim");
    expect(hits.some((h) => h.group === "Invoices")).toBe(true);
    expect(hits.some((h) => h.group === "Passports" && h.label === "Z1234567")).toBe(true);
    const byPhone = await globalSearch(A.ctx, allPermissions, "01711000099");
    expect(byPhone.map((h) => h.label)).toContain("Phase Twelve Client");
    expect(await globalSearch(A.ctx, { clients: ["view"] }, "rahim")).toEqual([]);
    expect(await globalSearch(A.ctx, allPermissions, "r")).toEqual([]);
  });
});

describe("platform admin", () => {
  const actor = () => ({ userId: A.owner.id, agencyId: A.agency.id, name: "Owner" });

  it("is for super admins only", async () => {
    await expect(listAgencies(actor())).rejects.toThrow(/Platform administrators/);
    await prisma.user.update({ where: { id: A.owner.id }, data: { isSuperAdmin: true } });
  });

  it("creates, re-plans, suspends and opens an agency", async () => {
    const code = `p12-${Date.now().toString().slice(-6)}`;
    const { id } = await createAgency(actor(), {
      code,
      name: "New Travels",
      owner: { name: "New Owner", username: "owner", password: "Secret#2026" },
    });
    await expect(
      createAgency(actor(), {
        code,
        name: "Again",
        owner: { name: "Xander", username: "xyz", password: "Secret#2026" },
      }),
    ).rejects.toThrow(/taken/);
    await setAgencyPlan(actor(), id, "premium");
    const row = (await listAgencies(actor())).find((a) => a.id === id)!;
    expect(row).toMatchObject({ plan: "premium", status: "ACTIVE", users: 1 });

    const token = await startImpersonation(actor(), id);
    const opened = await consumeImpersonation(token);
    expect(opened).toMatchObject({
      username: "owner",
      agencyId: id,
      impersonatorName: A.owner.name,
    });
    expect(await consumeImpersonation(token)).toBeNull(); // one time only

    await setAgencyStatus(actor(), id, "SUSPENDED");
    expect(
      (await verifyLogin({ agencyCode: code, username: "owner", password: "Secret#2026" })).ok,
    ).toBe(false);
    await expect(startImpersonation(actor(), id)).rejects.toThrow(/Activate/);
    await expect(setAgencyStatus(actor(), A.agency.id, "SUSPENDED")).rejects.toThrow(/own agency/);
    await setAgencyStatus(actor(), id, "ACTIVE");
    expect(
      (await verifyLogin({ agencyCode: code, username: "owner", password: "Secret#2026" })).ok,
    ).toBe(true);
  });
});
