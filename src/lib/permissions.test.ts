import { describe, expect, it } from "vitest";
import { DEFAULT_ROLES, MODULE_KEYS, can, parsePermissions } from "./permissions";

describe("parsePermissions", () => {
  it("drops unknown modules, unknown actions and non arrays", () => {
    expect(
      parsePermissions({
        clients: ["view", "create", "fly"],
        nope: ["view"],
        vendors: "view",
        agents: [],
      }),
    ).toEqual({ clients: ["view", "create"] });
  });

  it("returns an empty map for garbage", () => {
    expect(parsePermissions(null)).toEqual({});
    expect(parsePermissions([1, 2])).toEqual({});
    expect(parsePermissions("x")).toEqual({});
  });
});

describe("can", () => {
  it("allows only granted actions", () => {
    const p = { clients: ["view", "create"] } as const;
    expect(can({ ...p, clients: [...p.clients] }, "clients", "create")).toBe(true);
    expect(can({ clients: ["view"] }, "clients", "create")).toBe(false);
    expect(can({}, "clients", "view")).toBe(false);
  });

  it("treats any granted action as implying view", () => {
    expect(can({ clients: ["export"] }, "clients", "view")).toBe(true);
  });
});

describe("default roles", () => {
  const byName = Object.fromEntries(DEFAULT_ROLES.map((r) => [r.name, r.permissions]));

  it("Owner can do everything", () => {
    for (const m of MODULE_KEYS) expect(can(byName.Owner!, m, "void")).toBe(true);
  });

  it("Viewer can view everything and create nothing", () => {
    for (const m of MODULE_KEYS) {
      expect(can(byName.Viewer!, m, "view")).toBe(true);
      expect(can(byName.Viewer!, m, "create")).toBe(false);
    }
  });

  it("Sales Staff cannot touch accounts or configuration", () => {
    expect(can(byName["Sales Staff"]!, "accounts", "view")).toBe(false);
    expect(can(byName["Sales Staff"]!, "configuration", "view")).toBe(false);
    expect(can(byName["Sales Staff"]!, "invoice_air", "create")).toBe(true);
  });
});
