import { expect, test } from "@playwright/test";
import { open, ownerPassword, signIn, viewerPassword } from "./helpers";

test("owner adds, finds and deactivates an airport", async ({ page }) => {
  // 3 char base36 code from the clock: ~46k values, so reruns rarely collide
  // with airports (active or deactivated) left by earlier runs.
  const code = (Date.now() % 46_656).toString(36).padStart(3, "0").toUpperCase();
  await signIn(page, "admin", ownerPassword);
  await open(page, "/settings/airports");
  await expect(page.getByRole("heading", { name: "Airports" })).toBeVisible({ timeout: 60_000 });

  await page.getByRole("button", { name: "Add Airport" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("IATA code").fill(code.toLowerCase());
  await dialog.getByLabel("Airport name").fill(`E2E Field ${code}`);
  await dialog.getByLabel("City").fill("Testville");
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Airport added")).toBeVisible();
  await expect(dialog).toBeHidden();

  await page.getByPlaceholder("Search airports").fill(code);
  await page.getByPlaceholder("Search airports").press("Enter");
  await expect(page).toHaveURL(new RegExp(`q=${code}`, "i"));
  const row = page.getByRole("row", { name: new RegExp(`E2E Field ${code}`) });
  await expect(row).toBeVisible();
  await expect(row.getByText(code, { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "Deactivate" }).click();
  await page.getByRole("button", { name: "OK" }).click();
  await expect(page.getByText("Deactivated", { exact: true })).toBeVisible();
  await expect(row).toHaveCount(0);
});

test("viewer can browse configuration but cannot create or edit", async ({ page }) => {
  await signIn(page, "viewer", viewerPassword);
  await open(page, "/settings/airports");
  await expect(page.getByRole("heading", { name: "Airports" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("DAC", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Airport" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);

  await open(page, "/settings/roles");
  await expect(page.getByRole("button", { name: "Add Role" })).toHaveCount(0);
  await open(page, "/settings/app");
  await expect(page.getByRole("button", { name: "Save settings" })).toHaveCount(0);
});
