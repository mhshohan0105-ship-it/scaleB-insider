// Plans and subscription periods (Step 9): the user limit, the admin's plan
// and period changes, and what the agency's Subscription page reports.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import {
  listAgencies,
  listPlans,
  savePlan,
  setAgencyStatus,
  setAgencySubscription,
  type AdminActor,
} from "@/server/services/admin/adminService";
import { createUser, setUserActive } from "@/server/services/users/userService";
import { subscriptionPage } from "@/server/services/subscription/subscriptionService";
import { makeAgency } from "@/tests/integration/helpers";

let A: Awaited<ReturnType<typeof makeAgency>>; // the platform admin's agency
let B: Awaited<ReturnType<typeof makeAgency>>; // a customer agency
let actor: AdminActor;
const tiny = `tiny-${randomUUID().slice(0, 6)}`;

beforeAll(async () => {
  A = await makeAgency("plat");
  B = await makeAgency("cust");
  await prisma.user.update({ where: { id: A.owner.id }, data: { isSuperAdmin: true } });
  actor = { userId: A.owner.id, agencyId: A.agency.id, name: A.owner.name };
  await savePlan(actor, null, {
    code: tiny,
    name: "Tiny",
    priceMonthly: "1500",
    priceYearly: "15000",
    maxUsers: 2,
    modules: ["invoice_air", "money_receipt"],
  });
});

const newUser = (username: string) => ({
  name: "Extra Staff",
  username,
  password: "Staff1234",
  roleId: B.roleIds.Viewer!,
  email: "",
  phone: "",
  employeeId: "",
});

describe("plan limits", () => {
  it("refuses a user beyond the plan's limit, also when one is switched back on", async () => {
    await setAgencySubscription(actor, B.agency.id, {
      plan: tiny,
      status: "ACTIVE",
      trialEndsAt: null,
      paidUntil: "2026-12-31",
    });
    // Owner and viewer already fill the two places.
    await expect(createUser(B.ctx, newUser("extra1"))).rejects.toThrow(/allows 2 active users/);

    await setUserActive(B.ctx, B.viewer.id, false);
    const { id } = await createUser(B.ctx, newUser("extra2"));
    expect(id).toBeTruthy();
    await expect(setUserActive(B.ctx, B.viewer.id, true)).rejects.toThrow(/allows 2/);
  });

  it("shows the agency its plan, price, users and period", async () => {
    const page = await subscriptionPage(B.agency.id);
    expect(page.plan).toMatchObject({ name: "Tiny", maxUsers: 2 });
    expect(page.plan.modules).toEqual(["invoice_air", "money_receipt"]);
    expect(page.priceLine).toBe("BDT 1,500.00 a month or BDT 15,000.00 a year");
    expect(page.activeUsers).toBe(2);
    expect(page.paidUntilOn).toBe("2026-12-31");
    expect(page.contact).not.toBeNull(); // the installation's first platform agency
  });
});

describe("platform admin", () => {
  it("puts an agency on a trial ending at the end of that Dhaka day", async () => {
    await setAgencySubscription(actor, B.agency.id, {
      plan: tiny,
      status: "TRIAL",
      trialEndsAt: "2026-11-21",
      paidUntil: null,
    });
    const b = await prisma.agency.findUniqueOrThrow({ where: { id: B.agency.id } });
    expect(b.status).toBe("TRIAL");
    expect(b.trialEndsAt?.toISOString()).toBe("2026-11-21T17:59:59.999Z");
    expect(b.paidUntil).toBeNull();
    const row = (await listAgencies(actor)).find((a) => a.id === B.agency.id)!;
    expect(row).toMatchObject({ trialEndsOn: "2026-11-21", plan: tiny });
    expect(row.subscription.trial).toBe(true);

    // Suspending and activating again keeps it a trial, not free use.
    await setAgencyStatus(actor, B.agency.id, "SUSPENDED");
    await setAgencyStatus(actor, B.agency.id, "ACTIVE");
    expect((await prisma.agency.findUniqueOrThrow({ where: { id: B.agency.id } })).status).toBe(
      "TRIAL",
    );
  });

  it("needs an end date for a trial and a known plan", async () => {
    await expect(
      setAgencySubscription(actor, B.agency.id, {
        plan: tiny,
        status: "TRIAL",
        trialEndsAt: null,
        paidUntil: null,
      }),
    ).rejects.toThrow(/end date/);
    await expect(
      setAgencySubscription(actor, B.agency.id, {
        plan: "no-such-plan",
        status: "ACTIVE",
        trialEndsAt: null,
        paidUntil: null,
      }),
    ).rejects.toThrow(/Choose a plan/);
  });

  it("keeps the code of a plan agencies use, and lists how many use it", async () => {
    const plan = (await listPlans(actor)).find((p) => p.code === tiny)!;
    expect(plan.agencies).toBe(1);
    await expect(savePlan(actor, plan.id, { ...plan, code: `${tiny}-x` })).rejects.toThrow(
      /cannot change/,
    );
    await savePlan(actor, plan.id, { ...plan, priceMonthly: "1800" });
    expect((await listPlans(actor)).find((p) => p.code === tiny)!.priceMonthly).toBe("1800.00");
  });

  it("is for platform administrators only", async () => {
    const outsider = { userId: B.owner.id, agencyId: B.agency.id, name: "x" };
    await expect(listPlans(outsider)).rejects.toThrow(/Platform administrators/);
    await expect(
      setAgencySubscription(outsider, B.agency.id, {
        plan: tiny,
        status: "ACTIVE",
        trialEndsAt: null,
        paidUntil: null,
      }),
    ).rejects.toThrow(/Platform administrators/);
  });
});
