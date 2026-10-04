import { expect, test } from "@playwright/test";
import { open, ownerPassword, signIn as signInOk, viewerPassword } from "./helpers";

/** Submits the login form without waiting for the result. */
async function signIn(page: import("@playwright/test").Page, username: string, password: string) {
  await open(page, "/login");
  await page.getByLabel("Agency code").fill("demo");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("unauthenticated visitors are sent to the login page", async ({ page }) => {
  await open(page, "/clients");
  await expect(page).toHaveURL(/\/login/);
});

test("wrong password shows an error", async ({ page }) => {
  await signIn(page, "admin", "not-the-password");
  await expect(page.getByText("Incorrect agency code, username or password.")).toBeVisible();
});

test("owner signs in, sees the full sidebar and signs out", async ({ page }) => {
  await signInOk(page, "admin", ownerPassword);
  await expect(page).toHaveURL(/\/dashboard/);

  const nav = page.getByRole("menu").first();
  for (const label of [
    "Dashboard",
    "Invoice (Air Ticket)",
    "Hajji Management",
    "Reports",
    "Configuration",
    "Feedback",
  ]) {
    await expect(nav.getByText(label, { exact: true })).toBeVisible();
  }

  await nav.getByText("Clients", { exact: true }).first().click();
  await page.getByRole("link", { name: "Combined Clients" }).click();
  await expect(page).toHaveURL(/\/clients\/combined$/);
  await expect(page.getByRole("heading", { name: "Combined Clients" })).toBeVisible();

  await page.getByText("Agency Owner").click();
  await page.getByText("Sign out").click();
  await expect(page).toHaveURL(/\/login/);
});

test("the menu search jumps to a page", async ({ page }) => {
  await signInOk(page, "admin", ownerPassword);
  await page.getByRole("combobox", { name: "Search" }).fill("balance trans");
  await page.locator(".ant-select-item-option").filter({ hasText: "Balance Transfer" }).click();
  await expect(page).toHaveURL(/\/accounts\/balancetransfer$/);
});

test("viewer signs in and sees the shell", async ({ page }) => {
  await signInOk(page, "viewer", viewerPassword);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Viewer · Demo Travels")).toBeVisible();
});
