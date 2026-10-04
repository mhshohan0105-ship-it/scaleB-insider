import { expect, test } from "@playwright/test";
import { open, signIn } from "./helpers";

test("global search, feedback with a notification, SMS page, security headers", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const stamp = Date.now().toString().slice(-6);
  await signIn(page, "admin");

  const res = await page.request.get("/dashboard");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");

  // Header search finds records, not only menu pages.
  const search = page.getByRole("combobox", { name: "Search" });
  await search.fill("Abdul Kar");
  await page.locator(".ant-select-item-option", { hasText: /^Abdul Karim · / }).click();
  await expect(page).toHaveURL(/\/clients\/[a-z0-9]+$/, { timeout: 30_000 });

  // Feedback reaches the administrators' bell and gets a reply.
  await open(page, "/feedback");
  await page.locator(".ant-radio-button-wrapper", { hasText: "Question" }).click();
  await page.getByLabel("Your feedback").fill(`Can we print in Bangla? ${stamp}`);
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByText("Thank you, your feedback was sent")).toBeVisible();
  const row = page.getByRole("row", { name: new RegExp(stamp) });
  await expect(row).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Notifications" }).click();
  await expect(page.getByText(`New feedback: Can we print in Bangla? ${stamp}`)).toBeVisible();
  await page.keyboard.press("Escape");

  await row.getByRole("button", { name: "Reply" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Reply", { exact: true })
    .fill("Planned for next release");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(row.getByText("Reply: Planned for next release")).toBeVisible();
  await expect(row.getByText("Done")).toBeVisible();

  await open(page, "/settings/sms");
  await expect(page.getByRole("heading", { name: "SMS", exact: true })).toBeVisible();
  await expect(page.getByText("Gateway", { exact: true })).toBeVisible();
});

test("only platform admins may open /admin", async ({ page }) => {
  await signIn(page, "viewer");
  await open(page, "/admin");
  await expect(page.getByText("No access")).toBeVisible();
});

test("platform admin creates an agency and opens it as the owner", async ({ page }) => {
  test.setTimeout(180_000);
  const code = `e2e-${Date.now().toString().slice(-7)}`;

  await signIn(page, "admin");
  await page.getByText("Agency Owner").first().click();
  await page.getByRole("link", { name: "Platform admin" }).click();
  await expect(page.getByRole("heading", { name: "Platform admin" })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole("button", { name: "New agency" }).click();
  await page.getByLabel("Agency code (used to sign in)").fill(code);
  await page.getByLabel("Agency name").fill("E2E Horizon Travels");
  await page.getByLabel("Owner name").fill("Horizon Owner");
  await page.getByLabel("Username").fill("owner");
  await page.getByLabel("First password").fill("Horizon#2026");
  await page.getByRole("button", { name: "Create" }).click();
  const row = page.getByRole("row", { name: new RegExp(code) });
  await expect(row).toBeVisible({ timeout: 30_000 });

  await row.getByRole("button", { name: "Open as owner" }).click();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await expect(
    page.getByText(/You are in E2E Horizon Travels as Horizon Owner, opened by Agency Owner/),
  ).toBeVisible({ timeout: 30_000 });
});
