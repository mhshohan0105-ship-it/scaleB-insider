import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { toAuditJson } from "./audit";

describe("toAuditJson", () => {
  it("drops secrets at any depth", () => {
    expect(toAuditJson({ name: "a", passwordHash: "x", nested: { password: "p", ok: 1 } })).toEqual(
      { name: "a", nested: { ok: 1 } },
    );
  });

  it("serialises dates and decimals as strings", () => {
    expect(
      toAuditJson({ at: new Date("2026-01-01T00:00:00Z"), amt: new Decimal("10.50") }),
    ).toEqual({ at: "2026-01-01T00:00:00.000Z", amt: "10.5" });
  });

  it("returns undefined for empty values", () => {
    expect(toAuditJson(null)).toBeUndefined();
    expect(toAuditJson(undefined)).toBeUndefined();
  });
});
