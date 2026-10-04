// Permissions on parties go through each party's own module.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { tenantDb } from "@/server/db/tenant";
import { makeAgency } from "@/tests/integration/helpers";

const session = vi.hoisted(() => ({ current: null as null | { user: Record<string, string> } }));
vi.mock("@/auth", () => ({ auth: async () => session.current }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": "vitest" }) }));

const { saveEntityAction, searchEntityAction, setEntityActiveAction } =
  await import("./entityActions");

let agency: Awaited<ReturnType<typeof makeAgency>>;
let sales: { id: string; agencyId: string; roleId: string; username: string };

function signInAs(u: { id: string; agencyId: string; roleId: string; username: string }) {
  session.current = {
    user: { id: u.id, agencyId: u.agencyId, roleId: u.roleId, username: u.username },
  };
}

const clientInput = {
  name: "Walk In",
  type: "INDIVIDUAL",
  creditLimit: "0",
  openingBalance: "0",
  openingBalanceType: "RECEIVABLE",
};
const vendorInput = {
  name: "Some Vendor",
  type: "OTHER",
  commissionPercent: "0",
  openingBalance: "0",
  openingBalanceType: "PAYABLE",
};

beforeAll(async () => {
  agency = await makeAgency("ent");
  sales = await tenantDb(agency.agency.id).user.create({
    data: {
      agencyId: agency.agency.id,
      name: "Sales",
      username: "sales",
      passwordHash: agency.owner.passwordHash,
      roleId: agency.roleIds["Sales Staff"]!,
    },
  });
});

beforeEach(() => {
  session.current = null;
});

describe("party permissions", () => {
  it("Sales Staff can create clients but not vendors, and can search vendors", async () => {
    signInAs(sales);
    expect(await saveEntityAction("clients", null, clientInput)).toMatchObject({ ok: true });
    expect(await saveEntityAction("vendors", null, vendorInput)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/permission/i),
    });
    expect(await searchEntityAction("vendors", "")).toMatchObject({ ok: true });
  });

  it("a Viewer cannot create or deactivate parties", async () => {
    signInAs(agency.owner);
    const created = await saveEntityAction("vendors", null, vendorInput);
    expect(created.ok).toBe(true);
    const id = created.ok ? created.data.id : "";

    signInAs(agency.viewer);
    expect((await saveEntityAction("clients", null, clientInput)).ok).toBe(false);
    expect((await setEntityActiveAction("vendors", id, false)).ok).toBe(false);
    expect(await searchEntityAction("clients", "")).toMatchObject({ ok: true });
  });

  it("rejects unknown list keys", async () => {
    signInAs(agency.owner);
    expect(await saveEntityAction("users", null, {})).toMatchObject({
      ok: false,
      error: "Unknown list",
    });
  });
});
