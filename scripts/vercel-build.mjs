// Build command on Vercel (package.json "vercel-build"): generate the Prisma
// client, bring the database schema up to date, then build the app.
// Migrations need a direct (unpooled) connection; Vercel's Neon integration
// provides it as DATABASE_URL_UNPOOLED (or set DIRECT_URL yourself).
import { execSync } from "node:child_process";

const run = (cmd, env = process.env) => execSync(cmd, { stdio: "inherit", env });

const direct =
  process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!direct) {
  console.error("DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables.");
  process.exit(1);
}

run("npx prisma generate");
run("npx prisma migrate deploy", { ...process.env, DATABASE_URL: direct });
run("npx next build");
