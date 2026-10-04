import { expect, test } from "@playwright/test";
import { choose, open, signIn } from "./helpers";

test("pilgrim → pre registration invoice → register → moallem transfer → cancel → refund", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const stamp = Date.now().toString();
  const name = `HAJJI E2E ${stamp.slice(-6)}`;
  const tracking = `N${stamp.slice(-8)}`;
  await signIn(page, "admin");

  // 1. Add the pilgrim.
  await open(page, "/hajj/pilgrims/new");
  await choose(page, "Paying client", "Abdul Karim", "Abdul");
  await page.getByLabel("Full name (as in passport)").fill(name);
  await page.getByLabel("Tracking no.").fill(tracking);
  await page.getByRole("button", { name: "Add pilgrim" }).click();
  await expect(page).toHaveURL(/\/hajj\/pilgrims\/(?!new$)[a-z0-9]+$/, { timeout: 30_000 });
  const pilgrimUrl = page.url();
  const pilgrimId = pilgrimUrl.split("/").pop()!;
  await expect(page.getByText("Pre registered").first()).toBeVisible();

  // 2. Bill the pre registration fee.
  await open(page, "/hajj/preregistration/new");
  await choose(page, "Client", "Abdul Karim", "Abdul");
  await choose(page, "Pilgrim", name, tracking);
  await page.locator("#itemInvoice_items_0_unitPrice").fill("37000");
  await page.locator("#itemInvoice_items_0_unitCost").fill("36500");
  await choose(page, "Vendor", "Makkah Hotels Group", "Makkah");
  await page.getByRole("button", { name: "Save & post" }).click();
  await expect(page).toHaveURL(/\/hajj\/preregistration\/(?!new$)[a-z0-9]+$/, { timeout: 30_000 });
  const invoiceNo = (await page.getByRole("heading", { level: 3 }).textContent())!.trim();
  expect(invoiceNo).toMatch(/^HPR-\d{4}-\d{5}$/);
  await expect(page.getByRole("link", { name })).toBeVisible();

  // 3. Register.
  await open(page, pilgrimUrl);
  await page.getByRole("button", { name: "Register" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Registration no.")
    .fill(`R${stamp.slice(-6)}`);
  await page.getByRole("dialog").getByRole("button", { name: "Register" }).click();
  await expect(page.getByText(`${name} registered`)).toBeVisible();
  await expect(page.getByText("Registered", { exact: true }).first()).toBeVisible();

  // 4. Moallem transfer with a charge.
  await open(page, "/hajj/management/moallemtransfer");
  await choose(page, "Pilgrims", name, tracking);
  await page.keyboard.press("Escape");
  await page.getByLabel("New moallem").fill("Moallem E2E");
  await page.getByLabel("Charge per pilgrim").fill("500");
  await page.getByRole("button", { name: "Save transfer" }).click();
  await expect(page).toHaveURL(/\/hajj\/management\/moallemtransfers/, { timeout: 30_000 });
  await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("Moallem E2E");

  // 5. Cancel the registration, then refund from the result.
  await open(page, `/hajj/management/cancelregistration?pilgrim=${pilgrimId}`);
  await page.getByLabel("Reason").fill("E2E cannot travel");
  await page.getByRole("button", { name: "Cancel registration" }).click();
  await expect(page.getByText(`${name}: registration cancelled`)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: `Refund ${invoiceNo}` }).click();
  await expect(page).toHaveURL(/\/refunds\/otherpackagehajj\/new\?invoice=/);
  await expect(page.getByText(invoiceNo).first()).toBeVisible();

  await open(page, pilgrimUrl);
  await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Moallem changed")).toBeVisible();
});
