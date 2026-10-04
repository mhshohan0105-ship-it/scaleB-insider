// CLAUDE.md hard rules 2 and 3: only src/server/accounting/post.ts writes
// journal rows, and nothing updates or deletes them.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const root = join(process.cwd(), "src");
const WRITE =
  /\b(journalEntry|journalLine)\s*\.\s*(create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany)\b/;
const RAW_WRITE = /(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"Journal(Entry|Line)"/i;

describe("journal write guard", () => {
  it("only post.ts creates journal rows, and nothing updates or deletes them", () => {
    const offenders: string[] = [];
    for (const file of files(root)) {
      const rel = relative(root, file).split(sep).join("/");
      const text = readFileSync(file, "utf8");
      text.split(/\r?\n/).forEach((line, i) => {
        const m = line.match(WRITE);
        const allowed = rel === "server/accounting/post.ts" && m && /create/.test(m[2]!);
        if ((m && !allowed) || RAW_WRITE.test(line))
          offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
