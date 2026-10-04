import { describe, expect, it } from "vitest";
import {
  businessDate,
  dateToIso,
  fiscalMonths,
  fiscalYear,
  isoToDate,
  monthStart,
  todayIso,
} from "./dates";

describe("business dates", () => {
  it("uses the Dhaka calendar day for today", () => {
    // 19:30 UTC is already the next day in Dhaka (UTC+6).
    expect(todayIso(new Date("2026-03-31T19:30:00Z"))).toBe("2026-04-01");
    expect(todayIso(new Date("2026-03-31T17:59:00Z"))).toBe("2026-03-31");
  });

  it("round trips through the @db.Date representation", () => {
    const d = isoToDate("2026-02-28");
    expect(d.toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(dateToIso(d)).toBe("2026-02-28");
  });

  it("rejects impossible dates", () => {
    expect(() => isoToDate("2026-02-30")).toThrow();
    expect(() => isoToDate("28/02/2026")).toThrow();
    expect(businessDate().safeParse("2026-13-01").success).toBe(false);
    expect(businessDate().safeParse("2026-12-31").success).toBe(true);
  });
});

describe("fiscal year helpers", () => {
  it("finds the July-June fiscal year", () => {
    expect(fiscalYear("2026-09-28", 7)).toEqual({
      from: "2026-07-01",
      to: "2027-06-30",
      label: "2026-27",
    });
    expect(fiscalYear("2026-03-15", 7)).toEqual({
      from: "2025-07-01",
      to: "2026-06-30",
      label: "2025-26",
    });
    expect(fiscalYear("2026-03-15", 1)).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
      label: "2026",
    });
  });

  it("lists fiscal months and month starts", () => {
    expect(fiscalMonths("2026-07-01")).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
      "2027-05",
      "2027-06",
    ]);
    expect(monthStart("2026-09-28")).toBe("2026-09-01");
  });
});
