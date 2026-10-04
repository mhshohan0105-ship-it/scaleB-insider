import { expect, test } from "@playwright/test";
import { choose, open, pickDate, signIn } from "./helpers";

test("ticket → reissue → refund with charges → void refund → void list", async ({ page }) => {
  test.setTimeout(180_000);
  const stamp = Date.now().toString();
  const ticketNo = `157${stamp.slice(-10)}`;
  const client = `E2E Refund ${stamp}`;
  await signIn(page, "admin");

  await open(page, "/clients");
  await page.getByRole("button", { name: "Add Client" }).click();
  await page.getByRole("dialog").getByLabel("Client name").fill(client);
  await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Client added")).toBeVisible();

  // 1. Non commission ticket: sold 20,000, bought 18,000.
  await open(page, "/invoices/noncommission/new");
  await choose(page, "Client", client, stamp);
  await page.getByLabel("Ticket no.").fill(ticketNo);
  await choose(page, "Airline", "Emirates", "Emirates");
  await choose(page, "Vendor", "Skyline Air Consolidators", "Skyline");
  await page.getByLabel("Passenger name").fill("E2E REFUNDER");
  await page.getByLabel("Route").fill("DAC-DXB");
  await pickDate(page, "Journey date", "20 Nov 2026");
  await page.getByLabel("Purchase price").fill("18000");
  await page.getByLabel("Client price").fill("20000");
  await page.getByRole("button", { name: "Save & post" }).click();
  await expect(page).toHaveURL(/\/invoices\/noncommission\/(?!new$)[a-z0-9]+$/, {
    timeout: 30_000,
  });
  const invoiceUrl = page.url();

  // 2. Reissue it: 2,000 penalty + 1,000 fare difference + 500 service charge.
  await open(page, "/invoices/reissue/new");
  await choose(page, "Client", client, stamp);
  await choose(page, "Original ticket", ticketNo, ticketNo);
  await page.getByLabel("Airline penalty").fill("2000");
  await page.getByLabel("Fare difference").fill("1000");
  await page.locator("#reissueInvoice_lines_0_serviceCharge").fill("500");
  await expect(page.getByText("Client pays 3,500.00")).toBeVisible();
  await expect(page.getByText("Profit 500.00")).toBeVisible();
  await page.getByRole("button", { name: "Save & post" }).click();
  await expect(page).toHaveURL(/\/invoices\/reissue\/(?!new$)[a-z0-9]+$/, { timeout: 30_000 });
  expect((await page.getByRole("heading", { level: 3 }).textContent())!.trim()).toMatch(
    /^RIS-\d{4}-\d{5}$/,
  );
  await expect(page.getByText(ticketNo)).toBeVisible();

  // 3. Refund the original ticket: client pays 1,000 charge, airline keeps 500.
  await open(page, invoiceUrl);
  await page.getByRole("link", { name: "rollback Refund" }).click();
  await expect(page).toHaveURL(/\/refunds\/airticket\/new\?invoice=/);
  await page.getByRole("checkbox", { name: new RegExp(`Refund ${ticketNo}`) }).check();
  await page.getByLabel("Refund charge").fill("1000");
  await page.getByLabel("Vendor charge 1").fill("500");
  await expect(page.getByText("19,000.00").first()).toBeVisible(); // credit to client
  await expect(page.getByText("17,500.00").first()).toBeVisible(); // back from vendor
  await page.getByRole("button", { name: "Save refund" }).click();
  await expect(page).toHaveURL(/\/refunds\/airticket\/(?!new$)[a-z0-9]+$/, { timeout: 30_000 });
  const refundNo = (await page.getByRole("heading", { level: 3 }).textContent())!.trim();
  expect(refundNo).toMatch(/^RF-\d{4}-\d{5}$/);

  await open(page, invoiceUrl);
  await expect(page.getByText("Refunded", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: refundNo })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);

  // 4. Void the refund; it shows on the Void List and the invoice is live again.
  await page.getByRole("link", { name: refundNo }).click();
  await page.getByRole("button", { name: "Void" }).click();
  await page.getByRole("dialog").getByLabel("Reason").fill("E2E wrong charge");
  await page.getByRole("dialog").getByRole("button", { name: "Void" }).click();
  await expect(page.getByText("Void: E2E wrong charge")).toBeVisible();

  await open(page, invoiceUrl);
  await expect(page.getByText("Unpaid")).toBeVisible();
  await open(page, "/reports/voidlist");
  await expect(page.getByRole("link", { name: refundNo })).toBeVisible();
});
