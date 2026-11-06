import { describe, expect, it } from "vitest";
import { NAV } from "./nav";
import { HUB_COUNT_KEYS, SETTINGS_HUB } from "./settingsHub";

describe("settings hub", () => {
  it("offers every configuration page in the menu", () => {
    const config = NAV.find((m) => m.module === "configuration")!;
    const hub = new Set(SETTINGS_HUB.flatMap((s) => s.entries.map((e) => e.href)));
    for (const leaf of config.children!) {
      if (leaf.href !== config.hub) expect(hub.has(leaf.href), leaf.href).toBe(true);
    }
  });

  it("counts only entity lists", () => {
    expect(HUB_COUNT_KEYS).toContain("airports");
    expect(HUB_COUNT_KEYS).not.toContain("profile");
  });
});
