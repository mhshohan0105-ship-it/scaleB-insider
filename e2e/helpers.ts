import { expect, type Locator, type Page } from "@playwright/test";

export const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "Insider#2026";
export const viewerPassword = process.env.SEED_VIEWER_PASSWORD ?? "Viewer#2026";

/** Navigates and waits until React has hydrated (buttons respond to clicks). */
export async function open(page: Page, url: string) {
  await page.goto(url);
  await page.locator('html[data-hydrated="true"]').waitFor({ timeout: 30_000 });
}

export async function signIn(page: Page, username: "admin" | "viewer" | string, password?: string) {
  await open(page, "/login");
  await page.getByLabel("Agency code").fill("demo");
  await page.getByLabel("Username").fill(username);
  await page
    .getByLabel("Password")
    .fill(password ?? (username === "viewer" ? viewerPassword : ownerPassword));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await page.locator('html[data-hydrated="true"]').waitFor({ timeout: 30_000 });
}

/** Opens an antd Select by its label, optionally types a search, and picks an option. */
export async function choose(page: Page, label: string, option: string, search?: string) {
  // By accessible name, so a hidden "(optional)" hint in the label does not matter.
  const input = page.getByRole("combobox", { name: label, exact: true });
  await input.click();
  if (search) await input.fill(search);
  // Scope to this select's own dropdown; another one may still be animating closed.
  const listId = await input.getAttribute("aria-controls");
  const dropdown = listId
    ? page.locator(`.ant-select-dropdown:has([id="${listId}"])`)
    : page.locator(".ant-select-dropdown:visible");
  await dropdown.locator(".ant-select-item-option").filter({ hasText: option }).first().click();
}

/** Clicks until `target` shows (guards against a click landing mid-render). */
export async function clickUntilVisible(button: Locator, target: Locator) {
  await expect(async () => {
    if (!(await target.isVisible())) await button.click();
    await expect(target).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
}

/** Types a date into an antd DatePicker (format "DD MMM YYYY") and confirms it. */
export async function pickDate(page: Page, label: string, value: string) {
  const input = page.getByLabel(label, { exact: true });
  await input.click();
  await input.fill(value);
  await input.press("Enter");
}
