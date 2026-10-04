import { expect, test } from "@playwright/test";
import { choose, open, signIn } from "./helpers";

test("other services invoice with a cost line posts and prints", async ({ page }) => {
  const stamp = Date.now().toString();
  await signIn(page, "admin");

  await open(page, "/invoices/other/new");
  await choose(page, "Client", "Nasima Akter", "Nasima");
  await page.getByLabel("Qty").fill("2");
  await page.getByLabel("Description").fill(`Hotel night E2E ${stamp}`);
  await page.getByLabel("Unit price").fill("3500");
  await page.getByLabel("Unit cost").fill("3000");
  await choose(page, "Vendor", "Makkah Hotels Group", "Makkah");

  // 2 × 3,500 sold, 2 × 3,000 cost → 1,000 profit.
  await expect(page.getByText("7,000.00").first()).toBeVisible();
  await expect(page.getByText("1,000.00").first()).toBeVisible();

  await page.getByRole("button", { name: "Save & post" }).click();
  await expect(page).toHaveURL(/\/invoices\/other\/(?!new$)[a-z0-9]+$/, { timeout: 30_000 });
  const invoiceNo = (await page.getByRole("heading", { level: 3 }).textContent())!.trim();
  expect(invoiceNo).toMatch(/^OTH-\d{4}-\d{5}$/);
  await expect(page.getByText(`Hotel night E2E ${stamp}`)).toBeVisible();

  const pdf = await page.request.get(page.url().replace("/invoices/other/", "/api/pdf/invoice/"));
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");

  // It is listed with the other services invoices, not the air ticket ones.
  await open(page, "/invoices/other");
  await expect(page.getByRole("link", { name: invoiceNo })).toBeVisible();
  await open(page, `/invoices/airticket?q=${invoiceNo}`);
  await expect(page.getByRole("link", { name: invoiceNo })).toHaveCount(0);
});

test("visa invoice moves through the Visa Process board", async ({ page }) => {
  const stamp = Date.now().toString();
  const passenger = `VISA E2E ${stamp}`;
  await signIn(page, "admin");

  await open(page, "/invoices/visa/new");
  await choose(page, "Client", "Abdul Karim", "Abdul");
  await page.getByLabel("Passenger name").fill(passenger);
  await page.getByLabel("Passport no.").fill(`A${stamp.slice(-8)}`);
  await page.getByLabel("Country").fill("Thailand");
  await choose(page, "Vendor", "Gulf Visa Services", "Gulf");
  await page.getByLabel("Client price").fill("6500");
  await page.getByLabel("Cost").fill("5200");
  await page.getByRole("button", { name: "Save & post" }).click();
  await expect(page).toHaveURL(/\/invoices\/visa\/(?!new$)[a-z0-9]+$/, { timeout: 30_000 });
  const invoiceNo = (await page.getByRole("heading", { level: 3 }).textContent())!.trim();
  expect(invoiceNo).toMatch(/^VIS-\d{4}-\d{5}$/);

  const pdf = await page.request.get(page.url().replace("/invoices/visa/", "/api/pdf/invoice/"));
  expect(pdf.headers()["content-type"]).toContain("application/pdf");

  // Board: Pending → Submitted → Approved → Delivered.
  await open(page, `/invoices/visa/process?q=${encodeURIComponent(passenger)}`);
  const card = page.getByTestId("visa-card").filter({ hasText: passenger });
  await expect(card).toHaveCount(1);
  for (const step of ["Submitted", "Approved", "Delivered"]) {
    await card.getByRole("button", { name: step, exact: true }).click();
    await expect(page.getByText(`Marked ${step.toLowerCase()}`)).toBeVisible();
    await expect(card.getByRole("button", { name: step, exact: true })).toHaveCount(0);
  }
  await expect(card.getByText(/^delivered /)).toBeVisible();
  await expect(card.getByRole("link", { name: invoiceNo })).toBeVisible();
});
