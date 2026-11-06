import { describe, expect, it } from "vitest";
import { trend } from "./trend";

describe("trend", () => {
  it("gives the direction and whole percent", () => {
    expect(trend("150.00", "100.00")).toEqual({ direction: "up", percent: "50" });
    expect(trend("75.00", "100.00")).toEqual({ direction: "down", percent: "25" });
    expect(trend("100.00", "100.00")).toEqual({ direction: "flat", percent: "0" });
    expect(trend("100.00", "300.00")).toEqual({ direction: "down", percent: "67" });
  });

  it("has no percent when the earlier period had nothing", () => {
    expect(trend("500.00", "0.00")).toEqual({ direction: "up", percent: null });
    expect(trend("0.00", "0.00")).toEqual({ direction: "flat", percent: null });
  });
});
