// Step 9 parts 2, 3 and 6: self sign-up with a mobile code, subscription
// payments that renew the plan, and the daily alerts.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import type { AdminActor } from "@/server/services/admin/adminService";
import { checkNightlyBackup, subscriptionReminders } from "@/server/services/alerts/platformAlerts";
import { publicAgencyCard } from "@/server/services/agency/brandingService";
import {
  setSignupSmsForTests,
  signUp,
  requestSignupCode,
} from "@/server/services/signup/signupService";
import {
  mySubscriptionPayments,
  recordSubscriptionPayment,
  voidSubscriptionPayment,
} from "@/server/services/subscription/paymentService";
import { makeAgency } from "@/tests/integration/helpers";

let A: Awaited<ReturnType<typeof makeAgency>>;
let actor: AdminActor;
const sent: { to: string; text: string }[] = [];
const uniq = () => randomUUID().replace(/\D/g, "").padEnd(8, "7").slice(0, 8);
const mobile = () => `017${uniq()}`;

beforeAll(async () => {
  A = await makeAgency("saas");
  await prisma.user.update({ where: { id: A.owner.id }, data: { isSuperAdmin: true } });
  actor = { userId: A.owner.id, agencyId: A.agency.id, name: A.owner.name };
  setSignupSmsForTests({
    on: true,
    provider: {
      name: "test",
      async send(to: string, text: string) {
        sent.push({ to, text });
        return { status: "SENT" as const };
      },
    } as never,
  });
});

afterAll(() => setSignupSmsForTests(null));

const form = (phone: string, code: string, otp?: string) => ({
  agencyName: "Bright Sky Travels",
  code,
  ownerName: "Rina Akter",
  phone,
  email: "",
  username: "rina",
  password: "Bright1234",
  otp,
  acceptTerms: true,
  website: "",
});

describe("self sign-up", () => {
  it("needs the code sent by SMS, then opens a trial agency", async () => {
    const phone = mobile();
    const code = `bright-${uniq()}`;
    const ip = `10.0.${randomUUID().slice(0, 4)}`;
    await requestSignupCode({ phone }, ip);
    const otp = sent.at(-1)!.text.slice(0, 6);
    expect(otp).toMatch(/^\d{6}$/);

    await expect(
      signUp(form(phone, code, otp === "000000" ? "111111" : "000000"), ip),
    ).rejects.toThrow(/not right/);
    const now = new Date();
    const r = await signUp(form(phone, code, otp), ip, now);
    expect(r).toMatchObject({ code, username: "rina" });

    const agency = await prisma.agency.findUniqueOrThrow({ where: { code } });
    expect(agency.status).toBe("TRIAL");
    expect(agency.signupPhone).toBe(`88${phone}`);
    expect(agency.phone).toBe(phone);
    // To the end of the 14th Dhaka day from today.
    const last = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    expect(agency.trialEndsAt!.toISOString()).toBe(
      `${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(last)}T17:59:59.999Z`,
    );

    // One trial per mobile number.
    await expect(requestSignupCode({ phone }, ip)).rejects.toThrow(/already has an agency/);
    // The sign-in page can show who this is.
    expect(await publicAgencyCard(code)).toMatchObject({ name: "Bright Sky Travels", logo: null });
  });

  it("refuses bots, taken codes and too many codes for one number", async () => {
    const phone = mobile();
    await expect(
      signUp({ ...form(phone, `x-${uniq()}`), website: "http://spam" }, null),
    ).rejects.toThrow();
    await requestSignupCode({ phone }, null);
    await expect(
      signUp(form(phone, A.agency.code, sent.at(-1)!.text.slice(0, 6)), null),
    ).rejects.toThrow(/is taken/);
    await requestSignupCode({ phone }, null);
    await requestSignupCode({ phone }, null);
    await expect(requestSignupCode({ phone }, null)).rejects.toThrow(/Too many codes/);
  });
});

describe("subscription payments", () => {
  it("renews the plan from the payment day, continues an unexpired period, and voids back", async () => {
    const B = await makeAgency("payer");
    const first = await recordSubscriptionPayment(actor, B.agency.id, {
      date: "2026-11-07",
      amount: "1500",
      method: "MOBILE",
      reference: "TX1",
      plan: "standard",
      months: 1,
    });
    expect(first.number).toMatch(/^SUB-2026-\d{5}$/);
    let b = await prisma.agency.findUniqueOrThrow({ where: { id: B.agency.id } });
    expect(b.status).toBe("ACTIVE");
    expect(b.paidUntil?.toISOString()).toBe("2026-12-06T17:59:59.999Z");

    const second = await recordSubscriptionPayment(actor, B.agency.id, {
      date: "2026-11-20",
      amount: "15000",
      method: "BANK",
      plan: "premium",
      months: 12,
    });
    b = await prisma.agency.findUniqueOrThrow({ where: { id: B.agency.id } });
    expect(b.plan).toBe("premium");
    expect(b.paidUntil?.toISOString()).toBe("2027-12-06T17:59:59.999Z");

    const mine = await mySubscriptionPayments(B.agency.id);
    expect(mine.map((p) => [p.periodFrom, p.periodTo])).toEqual([
      ["2026-12-07", "2027-12-06"],
      ["2026-11-07", "2026-12-06"],
    ]);
    // Another agency never sees them.
    expect(await mySubscriptionPayments(A.agency.id)).toEqual([]);

    await voidSubscriptionPayment(actor, second.id, { reason: "Bounced transfer" });
    b = await prisma.agency.findUniqueOrThrow({ where: { id: B.agency.id } });
    expect(b.paidUntil?.toISOString()).toBe("2026-12-06T17:59:59.999Z");
    await expect(voidSubscriptionPayment(actor, second.id, { reason: "Again" })).rejects.toThrow(
      /already void/,
    );
  });

  it("is for platform administrators only", async () => {
    const outsider = { userId: A.viewer.id, agencyId: A.agency.id, name: "x" };
    await expect(
      recordSubscriptionPayment(outsider, A.agency.id, {
        date: "2026-11-07",
        amount: "1",
        method: "CASH",
        plan: "standard",
        months: 1,
      }),
    ).rejects.toThrow(/Platform administrators/);
  });
});

describe("daily alerts", () => {
  it("reminds an agency 3 days before its trial ends and lists it for the platform", async () => {
    const C = await makeAgency("ending");
    const now = new Date("2026-11-07T03:00:00Z");
    await prisma.agency.update({
      where: { id: C.agency.id },
      data: { status: "TRIAL", trialEndsAt: new Date("2026-11-10T17:59:59.999Z") },
    });
    const listed = await subscriptionReminders(now);
    expect(listed.some((l) => l.startsWith(`${C.agency.name} (${C.agency.code}): trial 3d`))).toBe(
      true,
    );
    const n = await prisma.notification.findFirst({
      where: { agencyId: C.agency.id, kind: "SUBSCRIPTION_REMINDER" },
    });
    expect(n?.title).toBe("Your free trial ends in 3 days.");
  });

  it("raises an alert when no backup succeeded in the last day", async () => {
    const r = await checkNightlyBackup(new Date("2100-01-01T00:00:00Z"));
    expect(r.ok).toBe(false);
    const n = await prisma.notification.findFirst({
      where: { agencyId: A.agency.id, kind: "BACKUP_MISSING" },
    });
    expect(n?.title).toBe("No database backup in the last day");
  });
});
