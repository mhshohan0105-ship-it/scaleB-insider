import { describe, expect, it } from "vitest";
import { cellText } from "./format";

describe("report cell text", () => {
  it("formats dates and money", () => {
    expect(cellText({ key: "d", title: "D", type: "date" }, "2026-09-30")).toBe("30 Sept 2026");
    expect(cellText({ key: "m", title: "M", type: "money" }, "150000.5")).toBe("1,50,000.50");
  });
  it("keeps labels that totals rows put in date or money columns", () => {
    expect(cellText({ key: "d", title: "D", type: "date" }, "Total")).toBe("Total");
    expect(cellText({ key: "m", title: "M", type: "money" }, "3 tickets")).toBe("3 tickets");
    expect(cellText({ key: "n", title: "N", type: "number" }, "12")).toBe("12");
  });
});
