import { expect, test } from "@playwright/test";
import { choose, open, signIn } from "./helpers";

// Combined client: sale on its client account, purchase on its vendor account,
// net on the profile, then a set-off of the smaller side.
test("combined client sells and buys, shows the net and sets off", async ({ page }) => {
  test.setTimeout(240_000);
  const name = `E2E Partner ${Date.now().toString().slice(-7)}`;
  await signIn(page, "admin");

  await open(page, "/clients/combined");
  await page.getByRole("button", { name: "Add Combined Client" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });

  // Sale to them: 5,000 (cost 4,000 from a hotel).
  await open(page, "/invoices/other/new");
  await choose(page, "Client", name, name);
  await page.getByLabel("Qty").fill("1");
  await page.getByLabel("Description").fill("Hotel for partner group");
  await page.getByLabel("Unit price").fill("5000");
  await page.getByLabel("Unit cost").fill("4000");
  await choose(page, "Vendor", "Makkah Hotels Group", "Makkah");
  await page.getByRole("button", { name: "Save & post" }).click();
  await expect(page).toHaveURL(/\/invoices\/other\/(?!new$)[a-z0-9]+$/, { timeout: 30_000 });

  // Purchase from them: 3,000 for another client.
  await open(page, "/invoices/other/new");
  await choose(page, "Client", "Nasima Akter", "Nasima");
  await page.getByLabel("Qty").fill("1");
  await page.getByLabel("Description").fill("Visa processing via partner");
  await page.getByLabel("Unit price").fill("3500");
  await page.getByLabel("Unit cost").fill("3000");
  await choose(page, "Vendor", name, name);
  await page.getByRole("button", { name: "Save & post" }).click();
  await expect(page).toHaveURL(/\/invoices\/other\/(?!new$)[a-z0-9]+$/, { timeout: 30_000 });

  // Profile: net 2,000 they owe; 5,000 on the client account, 3,000 on the vendor account.
  await open(page, `/clients/combined?q=${encodeURIComponent(name)}`);
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("2,000.00").first()).toBeVisible();
  await expect(page.getByText("5,000.00 Dr")).toBeVisible();
  await expect(page.getByText("3,000.00 Cr")).toBeVisible();

  // Set off the 3,000 we owe them against what they owe us.
  await page.getByRole("button", { name: "Set off" }).click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByText("Can be set off")).toBeVisible();
  await modal.getByRole("button", { name: "Save set-off" }).click();
  await expect(page.getByText(/Set-off SOF-\d{4}-\d{5} saved/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("2,000.00 Dr")).toBeVisible();
  await expect(page.getByText("0.00", { exact: true }).first()).toBeVisible();

  await page.getByRole("tab", { name: "Set-offs" }).click();
  await expect(page.getByRole("cell", { name: /^SOF-\d{4}-\d{5}$/ })).toBeVisible();
  await page.getByRole("tab", { name: "Ledger" }).click();
  await expect(page.getByText("Vendor a/c").first()).toBeVisible();
  await expect(page.getByText("Client a/c").first()).toBeVisible();
});
