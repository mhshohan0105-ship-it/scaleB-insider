import { describe, expect, it } from "vitest";
import { MASTERS, MASTER_KEYS, masterSchema } from "./masters";

describe("master definitions", () => {
  it("has a definition for every key with a required name-like field", () => {
    for (const key of MASTER_KEYS) {
      const def = MASTERS[key];
      expect(def.key).toBe(key);
      expect(def.fields.some((f) => f.required)).toBe(true);
      for (const s of def.searchFields) expect(def.fields.map((f) => f.name)).toContain(s);
    }
  });
});

describe("masterSchema", () => {
  const airport = masterSchema(MASTERS.airports);
  const employee = masterSchema(MASTERS.employees);
  const airline = masterSchema(MASTERS.airlines);

  it("uppercases codes and nulls blank optionals", () => {
    expect(
      airport.parse({ iata: " dac ", name: "Shahjalal Intl", city: "", country: undefined }),
    ).toEqual({
      iata: "DAC",
      name: "Shahjalal Intl",
      city: null,
      country: null,
    });
  });

  it("reports required fields", () => {
    const r = airport.safeParse({ iata: "", name: "" });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["iata", "name"]));
  });

  it("validates code length", () => {
    expect(airport.safeParse({ iata: "DA", name: "x" }).success).toBe(false);
    expect(airport.safeParse({ iata: "D-C", name: "x" }).success).toBe(false);
  });

  it("keeps money as a decimal string and rejects floats with too many decimals", () => {
    const ok = employee.parse({ name: "Rahim", salary: 25000.5, commissionPercent: "1.25" });
    expect(ok.salary).toBe("25000.5");
    expect(
      employee.safeParse({ name: "Rahim", salary: "10.123", commissionPercent: "0" }).success,
    ).toBe(false);
    expect(
      employee.safeParse({ name: "Rahim", salary: "-5", commissionPercent: "0" }).success,
    ).toBe(false);
  });

  it("does not coerce a blank required number or date into 0 / epoch", () => {
    expect(employee.safeParse({ name: "Rahim", salary: "", commissionPercent: "0" }).success).toBe(
      false,
    );
    const r = employee.parse({ name: "A", salary: "1", commissionPercent: "0", joinDate: "" });
    expect(r.joinDate).toBeNull();
  });

  it("limits percentages to 100", () => {
    expect(airline.safeParse({ iata: "BG", name: "Biman", commissionPercent: "101" }).success).toBe(
      false,
    );
    expect(
      airline.parse({ iata: "bg", name: "Biman", commissionPercent: "7" }).commissionPercent,
    ).toBe("7");
  });

  it("rejects unknown select values", () => {
    expect(airline.safeParse({ iata: "BG", name: "B", commissionBase: "WHATEVER" }).success).toBe(
      false,
    );
  });
});
