import { expect, test } from "@playwright/test";
import { choose, clickUntilVisible, open, pickDate, signIn } from "./helpers";

test("passport with expiry warning; quotation accepted and converted to a draft invoice", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const stamp = Date.now().toString();
  const passportNo = `E${stamp.slice(-8)}`;
  await signIn(page, "admin");

  // 1. A passport that expires in two months is flagged.
  const soon = new Date();
  soon.setUTCMonth(soon.getUTCMonth() + 2);
  const soonLabel = soon.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  await open(page, "/passports/new");
  await page.getByLabel("Passport no.").fill(passportNo);
  await page.getByLabel("Full name (as in passport)").fill("E2E PASSPORT HOLDER");
  await pickDate(page, "Expiry date", soonLabel);
  await page.getByRole("button", { name: "Save passport" }).click();
  await expect(page).toHaveURL(/\/passports\/(?!new$)[a-z0-9]+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: passportNo })).toBeVisible();
  await expect(page.getByText(/\d+ days left/)).toBeVisible();

  await open(page, `/passports?expiry=SOON&q=${passportNo}`);
  await expect(page.getByRole("link", { name: passportNo })).toBeVisible();

  // 2. Quotation: two lines, accepted, converted.
  await open(page, "/quotations/new");
  await choose(page, "Client", "Nasima Akter", "Nasima");
  await page.getByLabel("Subject").fill(`E2E trip ${stamp}`);
  await page.locator("#quotation_lines_0_description").fill("Hotel, 2 nights");
  await page.locator("#quotation_lines_0_qty").fill("2");
  await page.locator("#quotation_lines_0_unitPrice").fill("4500");
  await page.getByRole("button", { name: "Add line" }).click();
  await page.locator("#quotation_lines_1_description").fill("Airport pickup");
  await page.locator("#quotation_lines_1_qty").fill("1");
  await page.locator("#quotation_lines_1_unitPrice").fill("1500");
  await expect(page.getByText("10,500.00").first()).toBeVisible();
  await page.getByRole("button", { name: "Save quotation" }).click();
  await expect(page).toHaveURL(/\/quotations\/(?!new$)[a-z0-9]+$/, { timeout: 30_000 });
  const number = (await page.getByRole("heading", { level: 3 }).textContent())!.trim();
  expect(number).toMatch(/^QT-\d{4}-\d{5}$/);

  const pdf = await page.request.get(page.url().replace("/quotations/", "/api/pdf/quotation/"));
  expect(pdf.headers()["content-type"]).toContain("application/pdf");

  await page.getByRole("button", { name: "Accepted" }).click();
  await expect(page.getByText("Marked accepted")).toBeVisible();
  // The page refreshes after the status change; retry until the confirm opens.
  await clickUntilVisible(
    page.getByRole("button", { name: "Convert to invoice" }),
    page.getByRole("button", { name: "OK" }),
  );
  await page.getByRole("button", { name: "OK" }).click();
  await expect(page).toHaveURL(/\/invoices\/other\/[a-z0-9]+\/edit$/, { timeout: 30_000 });
  await expect(page.locator("#itemInvoice_items_0_description")).toHaveValue("Hotel, 2 nights");
  await expect(page.locator("#itemInvoice_items_1_description")).toHaveValue("Airport pickup");

  await open(page, `/quotations?q=${number}`);
  await expect(page.getByRole("row", { name: new RegExp(number) })).toContainText("Invoiced");
});
