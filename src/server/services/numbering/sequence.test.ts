import { describe, expect, it } from "vitest";
import { formatNumber } from "./sequence";

describe("formatNumber", () => {
  it("pads and optionally includes the year", () => {
    expect(formatNumber("CL", 7)).toBe("CL-00007");
    expect(formatNumber("MR", 123, 2026)).toBe("MR-2026-00123");
    expect(formatNumber("AG", 123456)).toBe("AG-123456");
  });
});
