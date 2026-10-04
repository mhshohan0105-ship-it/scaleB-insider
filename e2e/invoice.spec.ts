import { expect, test } from "@playwright/test";
import { choose, open, pickDate, signIn } from "./helpers";

test("air ticket invoice → partial money receipt → ledgers → vendor payment", async ({ page }) => {
  test.setTimeout(180_000); // long end-to-end flow
  const stamp = Date.now().toString();
  const ticketNo = `176${stamp.slice(-10)}`;
  const client = `E2E Traveller ${stamp}`;
  await signIn(page, "admin");

  // A fresh client, so earlier runs' invoices don't take the payment first.
  await open(page, "/clients");
  await page.getByRole("button", { name: "Add Client" }).click();
  await page.getByRole("dialog").getByLabel("Client name").fill(client);
  await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Client added")).toBeVisible();

  // 1. Invoice with one ticket: 40,000 base + 10,000 tax, 7% commission, sold at 49,500.
  await open(page, "/invoices/airticket/new");
  await choose(page, "Client", client, stamp);
  await page.getByLabel("Ticket no.").fill(ticketNo);
  await page.locator("#airInvoice_tickets_0_pnr").fill("E2EPNR");
  await choose(page, "Airline", "Emirates", "Emirates");
  await choose(page, "Vendor", "Skyline Air Consolidators", "Skyline");
  await page.getByLabel("Passenger name").fill("E2E TRAVELLER");
  await page.getByLabel("Route").fill("DAC-DXB-DAC");
  await pickDate(page, "Journey date", "15 Oct 2026");
  await page.getByLabel("Base fare").fill("40000");
  await page.getByRole("button", { name: "Tax" }).click();
  await page.getByPlaceholder("Code").fill("BD");
  await page.locator(".ant-space-compact").getByPlaceholder("0.00").fill("10000");
  await page.getByLabel("Commission %").fill("7");
  await page.getByLabel("Client price").fill("49500");

  // Live preview uses the same calculation as the server.
  await expect(page.getByText("47,350.00").first()).toBeVisible();
  await expect(page.getByText("2,150.00").first()).toBeVisible();

  await page.getByRole("button", { name: "Save & post" }).click();
  await expect(page).toHaveURL(/\/invoices\/airticket\/(?!new$)[a-z0-9]+$/, { timeout: 30_000 });
  await expect(page.getByText("Unpaid")).toBeVisible();
  const invoiceUrl = page.url();
  const invoiceNo = (await page.getByRole("heading", { level: 3 }).textContent())!.trim();
  expect(invoiceNo).toMatch(/^AIT-\d{4}-\d{5}$/);

  const pdf = await page.request.get(
    invoiceUrl.replace("/invoices/airticket/", "/api/pdf/invoice/"),
  );
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");

  // 2. Receive 20,000 against it.
  await page.getByRole("link", { name: "Receive payment" }).click();
  await expect(page).toHaveURL(/\/moneyreceipts\/new\?client=/);
  await expect(page.getByRole("cell", { name: invoiceNo })).toBeVisible();
  await page.getByLabel("Amount received").fill("20000");
  await expect(
    page.getByRole("row", { name: new RegExp(invoiceNo) }).getByText("20,000.00"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save receipt" }).click();
  await expect(page).toHaveURL(/\/moneyreceipts\/(?!new$)[a-z0-9]+$/, { timeout: 30_000 });
  await expect(page.getByText("Twenty Thousand Taka Only")).toBeVisible();
  const receiptPdf = await page.request.get(
    page.url().replace("/moneyreceipts/", "/api/pdf/receipt/"),
  );
  expect(receiptPdf.headers()["content-type"]).toContain("application/pdf");

  // 3. Invoice is now partly paid with 29,500 due.
  await open(page, invoiceUrl);
  await expect(page.getByText("Partly paid")).toBeVisible();
  await expect(page.getByText("29,500.00")).toBeVisible();

  // 4. Client ledger shows the invoice and the receipt.
  await page.getByRole("link", { name: client }).click();
  await page.getByRole("tab", { name: "Ledger" }).click();
  await expect(page).toHaveURL(/tab=ledger/);
  await expect(page.getByRole("link", { name: `Invoice ${invoiceNo}` })).toBeVisible();
  await expect(
    page
      .getByRole("row", { name: new RegExp(`Invoice ${invoiceNo}`) })
      .getByText("49,500.00")
      .first(),
  ).toBeVisible();

  // 5. Pay the vendor 5,000; it shows on the vendor's Payments tab.
  await open(page, "/vendors/payments");
  await choose(page, "Vendor", "Skyline Air Consolidators", "Skyline");
  await page.getByLabel("Amount").fill("5000");
  await choose(page, "Paid from", "Cash in Hand", "Cash in Hand");
  await page.getByRole("button", { name: "Save payment" }).click();
  await expect(page.getByText(/VP-\d{4}-\d{5} saved/)).toBeVisible();

  await page.getByRole("link", { name: "Skyline Air Consolidators" }).first().click();
  await page.getByRole("tab", { name: "Purchases" }).click();
  await expect(page.getByText(ticketNo)).toBeVisible();
  await page.getByRole("tab", { name: "Payments" }).click();
  await expect(page.getByRole("cell", { name: "5,000.00" }).first()).toBeVisible();
});
