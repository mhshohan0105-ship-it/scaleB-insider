import { describe, expect, it } from "vitest";
import { isRegistered, pilgrimActionError } from "./hajj";

describe("pilgrim rules", () => {
  const pre = { status: "PRE_REGISTERED" };
  const reg = { status: "REGISTERED", regNo: "R1" };
  const inReg = { status: "TRANSFERRED_IN", regNo: "R2" };
  const inPre = { status: "TRANSFERRED_IN", regNo: null };

  it("registers only pilgrims that are not registered yet", () => {
    expect(pilgrimActionError("REGISTER", pre)).toBeNull();
    expect(pilgrimActionError("REGISTER", inPre)).toBeNull();
    expect(pilgrimActionError("REGISTER", reg)).toMatch(/already registered/);
    expect(pilgrimActionError("REGISTER", inReg)).toMatch(/already registered/);
  });

  it("uses the right cancel for the stage", () => {
    expect(pilgrimActionError("CANCEL_PRE_REG", pre)).toBeNull();
    expect(pilgrimActionError("CANCEL_PRE_REG", reg)).toMatch(/already registered/);
    expect(pilgrimActionError("CANCEL_REG", reg)).toBeNull();
    expect(pilgrimActionError("CANCEL_REG", inReg)).toBeNull();
    expect(pilgrimActionError("CANCEL_REG", pre)).toMatch(/not registered/);
  });

  it("allows nothing on cancelled or transferred out pilgrims", () => {
    for (const action of ["REGISTER", "MOALLEM", "GROUP", "OUT", "CANCEL_REG"] as const) {
      expect(pilgrimActionError(action, { status: "CANCELLED" })).toMatch(/cancelled/);
      expect(pilgrimActionError(action, { status: "TRANSFERRED_OUT" })).toMatch(/transferred out/);
    }
    expect(pilgrimActionError("MOALLEM", pre)).toBeNull();
    expect(pilgrimActionError("OUT", reg)).toBeNull();
  });

  it("knows who is registered", () => {
    expect([pre, reg, inReg, inPre].map(isRegistered)).toEqual([false, true, true, false]);
  });
});
