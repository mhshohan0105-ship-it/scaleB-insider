import { describe, expect, it } from "vitest";
import { normalizeBdMobile, smsParts, visaSms } from "./sms";

describe("sms helpers", () => {
  it("normalises Bangladesh mobile numbers", () => {
    expect(normalizeBdMobile("01711000001")).toBe("8801711000001");
    expect(normalizeBdMobile("+880 1711-000001")).toBe("8801711000001");
    expect(normalizeBdMobile("8801911000003")).toBe("8801911000003");
    expect(normalizeBdMobile("029000001")).toBeNull(); // land line
    expect(normalizeBdMobile("01211000001")).toBeNull(); // no such operator
    expect(normalizeBdMobile("")).toBeNull();
  });

  it("counts message parts", () => {
    expect(smsParts("x".repeat(160))).toBe(1);
    expect(smsParts("x".repeat(161))).toBe(2);
    expect(smsParts("ভিসা".repeat(20))).toBe(2);
  });

  it("writes visa messages", () => {
    expect(
      visaSms("DELIVERED", {
        passengerName: "KARIM",
        country: "Thailand",
        agencyName: "Demo Travels",
      }),
    ).toBe("Dear client, the Thailand visa for KARIM is ready. Please collect it. - Demo Travels");
  });
});
