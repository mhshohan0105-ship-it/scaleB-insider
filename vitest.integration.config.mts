// Integration tests: services against a real PostgreSQL test database
// (DATABASE_URL from .env.test). The database is reset once per run.
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

const env = loadEnv("test", process.cwd(), "");

if (!env.DATABASE_URL?.includes("_test")) {
  throw new Error(
    "Refusing to run integration tests: DATABASE_URL in .env.test must point at a *_test database.",
  );
}

// globalSetup runs in this (main) process, so expose the test DB here too.
process.env.DATABASE_URL = env.DATABASE_URL;

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    env: { DATABASE_URL: env.DATABASE_URL, AUTH_SECRET: env.AUTH_SECRET ?? "test" },
    globalSetup: ["src/tests/integration/globalSetup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
