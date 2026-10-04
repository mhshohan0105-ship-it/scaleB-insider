import { execSync } from "node:child_process";

/**
 * Brings the test database schema up to date (non-destructive). Tests never
 * rely on an empty database: each file provisions its own agencies with
 * unique codes. To start from scratch, drop scaleb_insider_test manually.
 */
export default function setup() {
  const url = process.env.DATABASE_URL;
  if (!url?.includes("_test"))
    throw new Error("Integration DATABASE_URL must be a *_test database");
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
