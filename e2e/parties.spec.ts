import { expect, test } from "@playwright/test";
import { open, ownerPassword, signIn, viewerPassword } from "./helpers";

test("owner creates a client with an opening due and opens the profile", async ({ page }) => {
  const name = `E2E Client ${Date.now()}`;
  await signIn(page, "admin", ownerPassword);
  await open(page, "/clients");
  await page.getByRole("button", { name: "Add Client" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Client name").fill(name);
  await dialog.getByLabel("Phone").fill("01700000099");
  await dialog.getByLabel("Opening balance", { exact: true }).fill("2500");
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Client added")).toBeVisible();
  await expect(dialog).toBeHidden();

  await page.getByPlaceholder("Search clients").fill(name);
  await page.getByPlaceholder("Search clients").press("Enter");
  const row = page.getByRole("row", { name: new RegExp(name) });
  await expect(row.getByText(/^CL-\d{5}$/)).toBeVisible();
  await expect(row.getByText("2,500.00")).toBeVisible();

  await row.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("Current balance")).toBeVisible();
  await page.getByRole("tab", { name: "Ledger" }).click();
  await expect(
    page.getByRole("row", { name: /Opening balance/ }).getByText("2,500.00 Dr"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("dialog").getByLabel("Phone").fill("01700000100");
  await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Client updated")).toBeVisible();
  await expect(page.getByText("01700000100").first()).toBeVisible();
});

test("sibling sidebar pages are not mistaken for vendor profiles", async ({ page }) => {
  await signIn(page, "admin", ownerPassword);
  // A sibling page of /agents/[id] opens its own page, not an agent profile.
  await open(page, "/agents/payments");
  await expect(page.getByRole("heading", { name: "Agent Payment" })).toBeVisible();
  await expect(page.getByText("Agent not found")).toHaveCount(0);
});

test("viewer can open parties but not change them", async ({ page }) => {
  await signIn(page, "viewer", viewerPassword);
  await open(page, "/vendors");
  await expect(page.getByRole("heading", { name: "Vendors" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Vendor" })).toHaveCount(0);
  await page.getByRole("link", { name: "Skyline Air Consolidators" }).click();
  await expect(page.getByRole("heading", { name: "Skyline Air Consolidators" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
});
