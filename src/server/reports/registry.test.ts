import { describe, expect, it } from "vitest";
import { REPORT_GROUPS } from "@/lib/reports/catalog";
import { isReportKey } from "./registry";

describe("report registry", () => {
  it("runs every report the catalog offers", () => {
    const missing = REPORT_GROUPS.flatMap((g) => g.reports.map((r) => r.key)).filter(
      (k) => !isReportKey(k),
    );
    expect(missing).toEqual([]);
  });
});
