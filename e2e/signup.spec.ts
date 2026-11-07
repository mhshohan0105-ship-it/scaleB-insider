import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test("home page leads to sign-up, which opens a trial agency and signs the owner in", async ({
  page,
}) => {
  const stamp = Date.now().toString();
  await open(page, "/");
  await expect(page.getByRole("heading", { name: /One set of books for/ })).toBeVisible();
  await page.getByRole("link", { name: /Start 14 day free trial/ }).click();
  await expect(page).toHaveURL(/\/signup/);
  await page.locator('html[data-hydrated="true"]').waitFor();

  // No SMS gateway in tests, so no code is asked.
  await page.getByLabel("Agency name").fill(`E2E Wings ${stamp}`);
  await page.getByLabel("Agency code").fill(`e2e-${stamp}`);
  await page.getByLabel("Your name").fill("Trial Owner");
  await page.getByPlaceholder("01XXXXXXXXX").fill(`017${stamp.slice(-8)}`);
  await page.getByLabel("Username").fill("owner");
  await page.getByLabel("Password").fill("Trial12345");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create my agency" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
  await expect(page.getByText(/Free trial: 14 days left/)).toBeVisible();

  // Its Subscription page shows the trial.
  await open(page, "/settings/subscription");
  await expect(page.getByText("Free trial", { exact: true })).toBeVisible();
});

test("terms and privacy are public", async ({ page }) => {
  await open(page, "/terms");
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
  await open(page, "/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
});
