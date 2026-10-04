// Phase 1 acceptance: a Viewer cannot create. Calls the real server actions
// with a mocked session so the permission check itself is exercised.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { tenantDb } from "@/server/db/tenant";
import { makeAgency, TEST_PASSWORD } from "@/tests/integration/helpers";

const session = vi.hoisted(() => ({ current: null as null | { user: Record<string, string> } }));

vi.mock("@/auth", () => ({ auth: async () => session.current }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": "vitest" }) }));

const settingsActions = await import("./actions");
const entityActions = await import("../entityActions");
const actions = {
  ...settingsActions,
  saveMasterAction: entityActions.saveEntityAction,
  setMasterActiveAction: entityActions.setEntityActiveAction,
};

let agency: Awaited<ReturnType<typeof makeAgency>>;

function signInAs(user: { id: string; agencyId: string; roleId: string; username: string }) {
  session.current = {
    user: { id: user.id, agencyId: user.agencyId, roleId: user.roleId, username: user.username },
  };
}

beforeAll(async () => {
  agency = await makeAgency("perm");
});

beforeEach(() => {
  session.current = null;
});

describe("configuration actions", () => {
  it("a Viewer cannot create, edit, deactivate or manage users and roles", async () => {
    signInAs(agency.viewer);
    const db = tenantDb(agency.agency.id);
    const before = await db.airport.count();

    const create = await actions.saveMasterAction("airports", null, {
      iata: "VWR",
      name: "Viewer Port",
    });
    expect(create).toMatchObject({ ok: false, error: expect.stringMatching(/permission/i) });
    expect(await db.airport.count()).toBe(before);

    const anyAirport = await db.airport.findFirstOrThrow();
    expect(
      (await actions.saveMasterAction("airports", anyAirport.id, { iata: "DAC", name: "x" })).ok,
    ).toBe(false);
    expect((await actions.setMasterActiveAction("airports", anyAirport.id, false)).ok).toBe(false);

    const userResult = await actions.createUserAction({
      name: "Sneaky",
      username: "sneaky",
      roleId: agency.roleIds.Owner,
      password: TEST_PASSWORD,
    });
    expect(userResult.ok).toBe(false);
    expect(await db.user.count({ where: { username: "sneaky" } })).toBe(0);

    expect((await actions.saveRoleAction(null, { name: "Hackers", permissions: {} })).ok).toBe(
      false,
    );
    expect((await actions.saveAppConfigAction({})).ok).toBe(false);
  });

  it("an Owner can create through the same action", async () => {
    signInAs(agency.owner);
    const r = await actions.saveMasterAction("airports", null, { iata: "own", name: "Owner Port" });
    expect(r).toMatchObject({ ok: true });
    const saved = await tenantDb(agency.agency.id).airport.findFirst({ where: { iata: "OWN" } });
    expect(saved?.createdById).toBe(agency.owner.id);
  });

  it("returns field errors for invalid input and duplicates", async () => {
    signInAs(agency.owner);
    const invalid = await actions.saveMasterAction("airports", null, { iata: "", name: "" });
    expect(invalid.ok).toBe(false);
    expect(!invalid.ok && invalid.fieldErrors).toMatchObject({
      iata: expect.any(String),
      name: expect.any(String),
    });

    const dup = await actions.saveMasterAction("airports", null, { iata: "DAC", name: "Again" });
    expect(dup.ok).toBe(false);
    expect(!dup.ok && dup.fieldErrors?.iata).toMatch(/already exists/);
  });

  it("protects the Owner role and the signed in user's own account", async () => {
    signInAs(agency.owner);
    const ownerRole = await actions.saveRoleAction(agency.roleIds.Owner!, {
      name: "Owner",
      permissions: {},
    });
    expect(ownerRole).toMatchObject({ ok: false, error: expect.stringMatching(/Owner role/) });

    const selfOff = await actions.setUserActiveAction(agency.owner.id, false);
    expect(selfOff).toMatchObject({ ok: false, error: expect.stringMatching(/own account/) });

    const demote = await actions.updateUserAction(agency.owner.id, {
      name: "Owner",
      roleId: agency.roleIds.Viewer,
    });
    expect(demote).toMatchObject({ ok: false });
  });

  it("an Accountant can view but not change configuration", async () => {
    const db = tenantDb(agency.agency.id);
    const accountant = await db.user.create({
      data: {
        agencyId: agency.agency.id,
        name: "Acc",
        username: "acc",
        passwordHash: agency.owner.passwordHash,
        roleId: agency.roleIds.Accountant!,
      },
    });
    signInAs(accountant);
    expect((await actions.saveMasterAction("visatypes", null, { name: "Pilgrim" })).ok).toBe(false);
  });
});
