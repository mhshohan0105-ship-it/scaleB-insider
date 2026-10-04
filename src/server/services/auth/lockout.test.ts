import { describe, expect, it } from "vitest";
import { LOCKOUT_MAX_FAILURES, isLockedOut } from "./lockout";

const fail = { success: false };
const ok = { success: true };

describe("isLockedOut", () => {
  it("allows attempts below the limit", () => {
    expect(isLockedOut([])).toBe(false);
    expect(isLockedOut(Array(LOCKOUT_MAX_FAILURES - 1).fill(fail))).toBe(false);
  });

  it("locks after the limit of consecutive failures", () => {
    expect(isLockedOut(Array(LOCKOUT_MAX_FAILURES).fill(fail))).toBe(true);
  });

  it("resets the count after a success", () => {
    expect(isLockedOut([fail, fail, ok, fail, fail, fail, fail])).toBe(false);
  });
});
