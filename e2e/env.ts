import { readFileSync } from "node:fs";

/**
 * Database used by Playwright: the dev DATABASE_URL (from the environment or
 * .env) with the database name swapped for scaleb_insider_e2e, so browser
 * tests never write into the demo data you use day to day.
 */
export function e2eDatabaseUrl(): string {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  let base = process.env.DATABASE_URL;
  if (!base) {
    const line = readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("DATABASE_URL="));
    base = line?.slice("DATABASE_URL=".length).replace(/^"|"$/g, "");
  }
  if (!base) throw new Error("DATABASE_URL is not set (env or .env)");
  const url = new URL(base);
  url.pathname = "/scaleb_insider_e2e";
  return url.toString();
}
