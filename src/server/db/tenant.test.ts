import { describe, expect, it } from "vitest";
import { TENANT_MODELS, scopeArgs } from "./tenant";

const A = "agency-a";

describe("TENANT_MODELS", () => {
  it("includes tenant tables and excludes Agency", () => {
    expect(TENANT_MODELS.has("User")).toBe(true);
    expect(TENANT_MODELS.has("Airport")).toBe(true);
    expect(TENANT_MODELS.has("AuditLog")).toBe(true);
    expect(TENANT_MODELS.has("Agency")).toBe(false);
  });
});

describe("scopeArgs", () => {
  it("adds agencyId to reads and overrides a caller supplied one", () => {
    expect(scopeArgs("findMany", { where: { name: "x", agencyId: "evil" } }, A)).toEqual({
      where: { name: "x", agencyId: A },
    });
    expect(scopeArgs("count", undefined, A)).toEqual({ where: { agencyId: A } });
    expect(scopeArgs("findUnique", { where: { id: "1" } }, A)).toEqual({
      where: { id: "1", agencyId: A },
    });
  });

  it("stamps creates, including createMany arrays", () => {
    expect(scopeArgs("create", { data: { name: "x", agencyId: "evil" } }, A)).toEqual({
      data: { name: "x", agencyId: A },
    });
    expect(scopeArgs("createMany", { data: [{ name: "a" }, { name: "b" }] }, A)).toEqual({
      data: [
        { name: "a", agencyId: A },
        { name: "b", agencyId: A },
      ],
    });
  });

  it("prevents updates from moving rows to another agency", () => {
    expect(
      scopeArgs("update", { where: { id: "1" }, data: { name: "y", agencyId: "evil" } }, A),
    ).toEqual({ where: { id: "1", agencyId: A }, data: { name: "y" } });
  });

  it("scopes upsert on all three parts", () => {
    expect(
      scopeArgs(
        "upsert",
        { where: { id: "1" }, create: { name: "c" }, update: { agencyId: "evil", name: "u" } },
        A,
      ),
    ).toEqual({
      where: { id: "1", agencyId: A },
      create: { name: "c", agencyId: A },
      update: { name: "u" },
    });
  });

  it("rejects unknown operations", () => {
    expect(() => scopeArgs("somethingNew", {}, A)).toThrow(/unsupported/);
  });
});
