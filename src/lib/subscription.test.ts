import { describe, expect, it } from "vitest";
import {
  parsePlanModules,
  paymentPeriod,
  planPermissions,
  subscriptionStatus,
  userFits,
} from "./subscription";

const at = (iso: string) => new Date(iso);
const now = at("2026-11-07T10:00:00Z");

describe("subscriptionStatus", () => {
  it("never ends without an end date", () => {
    expect(
      subscriptionStatus({ status: "ACTIVE", trialEndsAt: null, paidUntil: null }, now),
    ).toEqual({ state: "ok", trial: false, endsAt: null, daysLeft: null });
  });

  it("shows a running trial as ending, and stops at its end", () => {
    const t = {
      status: "TRIAL" as const,
      trialEndsAt: at("2026-11-17T10:00:00Z"),
      paidUntil: null,
    };
    expect(subscriptionStatus(t, now)).toMatchObject({
      state: "ending",
      trial: true,
      daysLeft: 10,
    });
    expect(subscriptionStatus(t, at("2026-11-17T10:00:00Z")).state).toBe("expired");
  });

  it("paid: ok, then a reminder in the last week, then grace, then read only", () => {
    const a = {
      status: "ACTIVE" as const,
      trialEndsAt: null,
      paidUntil: at("2026-12-07T10:00:00Z"),
    };
    expect(subscriptionStatus(a, now).state).toBe("ok");
    expect(subscriptionStatus(a, at("2026-12-02T10:00:00Z")).state).toBe("ending");
    const g = subscriptionStatus(a, at("2026-12-09T10:00:00Z"));
    expect(g).toMatchObject({ state: "grace", daysLeft: 5, endsAt: "2026-12-14T10:00:00.000Z" });
    expect(subscriptionStatus(a, at("2026-12-14T10:00:00Z")).state).toBe("expired");
  });
});

describe("planPermissions", () => {
  const role = {
    dashboard: ["view" as const],
    invoice_air: ["view" as const, "create" as const, "edit" as const],
    hajj: ["view" as const, "create" as const],
    reports: ["view" as const, "export" as const],
    configuration: ["view" as const, "edit" as const],
  };

  it("keeps everything when the plan includes every module", () => {
    expect(planPermissions(role, { modules: [] }, "ok")).toEqual(role);
  });

  it("drops modules outside the plan but keeps the core ones", () => {
    const p = planPermissions(role, { modules: ["invoice_air", "reports"] }, "ok");
    expect(Object.keys(p).sort()).toEqual(["configuration", "dashboard", "invoice_air", "reports"]);
  });

  it("leaves only viewing and exporting once expired", () => {
    const p = planPermissions(role, { modules: [] }, "expired");
    expect(p.invoice_air).toEqual(["view"]);
    expect(p.reports).toEqual(["view", "export"]);
    expect(p.configuration).toEqual(["view"]);
  });
});

describe("parsePlanModules and userFits", () => {
  it("ignores unknown and core keys in stored modules", () => {
    expect(parsePlanModules(["hajj", "nope", "dashboard", "invoice_air"])).toEqual([
      "invoice_air",
      "hajj",
    ]);
    expect(parsePlanModules("x")).toEqual([]);
  });

  it("counts users against the plan, 0 meaning no limit", () => {
    expect(userFits(3, 2)).toBe(true);
    expect(userFits(3, 3)).toBe(false);
    expect(userFits(0, 500)).toBe(true);
  });
});

describe("paymentPeriod", () => {
  it("starts on the payment date when nothing is paid ahead", () => {
    expect(paymentPeriod(null, "2026-11-07", 1)).toEqual({ from: "2026-11-07", to: "2026-12-06" });
    expect(paymentPeriod("2026-10-31", "2026-11-07", 12)).toEqual({
      from: "2026-11-07",
      to: "2027-11-06",
    });
  });

  it("continues a paid period that has not ended", () => {
    expect(paymentPeriod("2026-11-30", "2026-11-07", 1)).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });
    expect(paymentPeriod("2027-01-30", "2027-01-10", 1)).toEqual({
      from: "2027-01-31",
      to: "2027-02-27",
    });
  });
});
