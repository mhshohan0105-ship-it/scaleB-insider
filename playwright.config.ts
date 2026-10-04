import { defineConfig, devices } from "@playwright/test";
import { e2eDatabaseUrl } from "./e2e/env";

const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  // Long flows run alongside other test files against one server.
  timeout: 120_000,
  expect: { timeout: 10_000 },
  globalSetup: "./e2e/globalSetup.ts",
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Production build: no on-demand compiling, so timings are stable. Built
    // into its own folder so it never clobbers a running dev server's .next,
    // and pointed at its own database (see e2e/env.ts).
    command: `npx next build && npx next start -p ${port}`,
    url: `http://localhost:${port}/login`,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      AUTH_TRUST_HOST: "true",
      DATABASE_URL: e2eDatabaseUrl(),
    },
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
