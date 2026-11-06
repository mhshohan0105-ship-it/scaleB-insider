import { describe, expect, it } from "vitest";
import { REPORT_GROUPS } from "./catalog";
import { reportDirectory } from "./directory";

const reportsOnly = { reports: ["view" as const] };

describe("reportDirectory", () => {
  it("lists every catalog report with a description and a link", () => {
    const entries = reportDirectory({
      ...reportsOnly,
      configuration: ["view" as const],
    }).flatMap((s) => s.entries);
    for (const r of REPORT_GROUPS.flatMap((g) => g.reports))
      expect(
        entries.find((e) => e.key === r.key),
        r.key,
      ).toBeTruthy();
    for (const e of entries) {
      expect(e.description, e.key).not.toBe("");
      expect(e.href, e.key).toMatch(/^\/reports\//);
    }
    expect(new Set(entries.map((e) => e.key)).size).toBe(entries.length);
  });

  it("hides what the role may not run", () => {
    const keys = reportDirectory(reportsOnly).flatMap((s) => s.entries.map((e) => e.key));
    expect(keys).toContain("sales");
    expect(keys).not.toContain("audit-trail");
    expect(reportDirectory({})).toEqual([]);
  });
});
