import { describe, expect, it } from "vitest";
import { maskAccountNo } from "./mask";

describe("maskAccountNo", () => {
  it("keeps only the last four characters", () => {
    expect(maskAccountNo("0123-4567-8901")).toBe("••••8901");
    expect(maskAccountNo("01711 000 111")).toBe("••••0111");
    expect(maskAccountNo("12")).toBe("••••12");
  });

  it("returns null for blanks", () => {
    expect(maskAccountNo("")).toBeNull();
    expect(maskAccountNo("  ")).toBeNull();
    expect(maskAccountNo(null)).toBeNull();
  });
});
