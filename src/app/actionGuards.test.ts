// Security review (Phase 12): every exported server action must establish who
// is calling before doing anything. A new action that forgets the check fails
// this test instead of shipping an open endpoint.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname);

/** Calls that authenticate (and usually authorise) the caller. */
const GUARDS = [
  "requirePermission(",
  "getUserContext(",
  // platform/actions.ts: builds the admin actor from the session; the admin
  // service then checks isSuperAdmin.
  "actor(",
];

/** Actions that are public on purpose. */
const PUBLIC = new Set(["(auth)/login/actions.ts#loginAction", "(app)/actions.ts#logoutAction"]);

function serverActionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return serverActionFiles(p);
    if (!/\.tsx?$/.test(name) || name.includes(".test.")) return [];
    return /^\s*["']use server["']/.test(readFileSync(p, "utf8")) ? [p] : [];
  });
}

/** Local helpers in the file that themselves call a guard. */
function localGuards(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/^(?:async )?function (\w+)\([^]*?^}/gm)) {
    if (GUARDS.some((g) => m[0].includes(g))) out.push(`${m[1]}(`);
  }
  return out;
}

describe("server actions", () => {
  const files = serverActionFiles(ROOT);

  it("are found", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const file of files) {
    const rel = file.slice(ROOT.length + 1).replaceAll("\\", "/");
    const src = readFileSync(file, "utf8");
    const guards = [...GUARDS, ...localGuards(src)];
    const parts = src.split(/^export async function /m).slice(1);
    for (const part of parts) {
      const name = part.match(/^(\w+)/)![1]!;
      if (PUBLIC.has(`${rel}#${name}`)) continue;
      it(`${rel} ${name} checks the caller`, () => {
        expect(guards.some((g) => part.includes(g))).toBe(true);
      });
    }
  }
});
