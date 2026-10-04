import { execSync } from "node:child_process";
import { e2eDatabaseUrl } from "./env";

/** Brings the e2e database schema up to date and loads the demo seed (both non-destructive). */
export default function globalSetup() {
  const env = { ...process.env, DATABASE_URL: e2eDatabaseUrl() };
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  execSync("npx prisma db seed", { stdio: "inherit", env });
}
