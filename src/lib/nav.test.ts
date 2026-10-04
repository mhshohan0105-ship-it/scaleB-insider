import { describe, expect, it } from "vitest";
import { MODULE_KEYS } from "./permissions";
import { NAV, entryPhase, findModuleForPath, findNavEntry, navEntries } from "./nav";

describe("nav", () => {
  it("covers every module exactly once", () => {
    expect(NAV.map((m) => m.module).sort()).toEqual([...MODULE_KEYS].sort());
  });

  it("has unique hrefs in lowercase without separators", () => {
    const hrefs = navEntries().map((e) => e.leaf.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const h of hrefs) expect(h).toMatch(/^(\/[a-z]+)+$/);
  });

  it("finds exact entries and owning modules", () => {
    expect(findNavEntry("/invoices/airticket/new")?.module.module).toBe("invoice_air");
    expect(findNavEntry("/invoices/airticket/")?.leaf.label).toBe("View Invoices");
    expect(findNavEntry("/nowhere")).toBeUndefined();
    expect(findModuleForPath("/invoices/visa/process")?.module).toBe("invoice_visa");
    expect(findModuleForPath("/clients/abc123")?.module).toBe("clients");
  });

  it("uses a page's own phase over its module's", () => {
    expect(entryPhase(findNavEntry("/vendors/payments")!)).toBe(4);
    expect(entryPhase(findNavEntry("/vendors")!)).toBe(2);
  });
});
