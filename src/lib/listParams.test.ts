import { describe, expect, it } from "vitest";
import { parseListParams } from "./listParams";

describe("parseListParams", () => {
  it("applies defaults", () => {
    expect(parseListParams({})).toEqual({ page: 1, pageSize: 20, q: "", status: "active" });
  });

  it("parses valid values", () => {
    expect(parseListParams({ page: "3", pageSize: "50", q: " dhaka ", status: "all" })).toEqual({
      page: 3,
      pageSize: 50,
      q: "dhaka",
      status: "all",
    });
  });

  it("falls back on junk instead of throwing", () => {
    expect(parseListParams({ page: "-4", pageSize: "7", status: "weird", q: ["a", "b"] })).toEqual({
      page: 1,
      pageSize: 20,
      q: "a",
      status: "active",
    });
  });

  it("keeps valid dates and drops invalid ones", () => {
    const p = parseListParams({ from: "2026-09-01", to: "2026-02-30" });
    expect(p.from).toBe("2026-09-01");
    expect(p.to).toBeUndefined();
  });
});
