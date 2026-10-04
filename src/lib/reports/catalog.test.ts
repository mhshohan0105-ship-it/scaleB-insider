import { describe, expect, it } from "vitest";
import { canRunReport } from "./access";
import { REPORT_GROUPS, REPORT_INFO } from "./catalog";

describe("report catalog", () => {
  it("has unique keys", () => {
    const keys = REPORT_GROUPS.flatMap((g) => g.reports.map((r) => r.key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps sensitive reports behind configuration access", () => {
    const reportsOnly = { reports: ["view" as const] };
    expect(canRunReport(reportsOnly, "sales")).toBe(true);
    expect(canRunReport(reportsOnly, "audit-trail")).toBe(false);
    expect(canRunReport({ ...reportsOnly, configuration: ["view" as const] }, "audit-trail")).toBe(
      true,
    );
    expect(canRunReport({}, "sales")).toBe(false);
    expect(REPORT_INFO["login-history"]?.requires?.module).toBe("configuration");
  });
});
