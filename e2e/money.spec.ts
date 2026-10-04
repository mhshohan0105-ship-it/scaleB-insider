import { expect, test } from "@playwright/test";
import { choose, open, signIn } from "./helpers";

test("expense with head, cheque receipt cleared, loan with schedule", async ({ page }) => {
  test.setTimeout(180_000);
  const stamp = Date.now().toString();
  const chequeNo = `CQ${stamp.slice(-7)}`;
  await signIn(page, "admin");

  // 1. Expense under a head.
  await open(page, "/expenses/new");
  await choose(page, "Expense head", "Stationery", "Station");
  await page.getByLabel("Amount", { exact: true }).fill("1500");
  await choose(page, "Paid from", "Cash in Hand", "Cash");
  await page.getByLabel("Reference").fill(`E2E-${stamp}`);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/expenses$/, { timeout: 30_000 });
  const row = page.getByRole("row", { name: new RegExp(`E2E-${stamp}`) });
  await expect(row).toContainText("Stationery");
  await expect(row).toContainText("1,500.00");
  await expect(row).toContainText(/EXP-\d{4}-\d{5}/);

  // 2. Money receipt by cheque, cleared from Cheque Management.
  await open(page, "/moneyreceipts/new");
  await choose(page, "Client", "Nasima Akter", "Nasima");
  await page.getByLabel("Amount received").fill("2500");
  // Not a search select: open it by its box, then pick from its own list.
  await page.locator(".ant-select:has(#receipt_paymentMethod)").click();
  await page
    .locator('.ant-select-dropdown:has([id="receipt_paymentMethod_list"]) .ant-select-item-option')
    .filter({ hasText: "Cheque" })
    .click();
  await page.getByLabel("Cheque no.").fill(chequeNo);
  await page.getByLabel("Cheque date").fill("30 Sep 2026");
  await page.getByLabel("Cheque date").press("Enter");
  await page.getByLabel("Bank (on the cheque)").fill("Dutch Bangla Bank");
  await page.getByRole("button", { name: "Save receipt" }).click();
  await expect(page).toHaveURL(/\/moneyreceipts\/(?!new$)[a-z0-9]+$/, { timeout: 30_000 });

  await open(page, `/cheques?q=${chequeNo}`);
  const cheque = page.getByRole("row", { name: new RegExp(chequeNo) });
  await expect(cheque).toContainText("Pending");
  await cheque.getByRole("button", { name: "Clear" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Clear" }).click();
  await expect(page.getByText(`Cheque ${chequeNo}: cleared`)).toBeVisible();
  await expect(cheque).toContainText("Cleared");

  // 3. A loan taken with a 12 month schedule.
  const lender = `E2E Bank ${stamp.slice(-5)}`;
  await open(page, "/loans/authorities");
  await page.getByRole("button", { name: "Add authority" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill(lender);
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("cell", { name: lender })).toBeVisible();

  await open(page, "/loans");
  await choose(page, "Lender", lender, lender);
  await page.getByLabel("Principal").fill("120000");
  await page.getByLabel("Yearly rate %").fill("12");
  await page.getByLabel("Term (months)").fill("12");
  await choose(page, "Received into", "Cash in Hand", "Cash");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const loanRow = page.getByRole("row", { name: new RegExp(lender) });
  await expect(loanRow).toContainText("1,20,000.00");
  await loanRow.getByRole("link", { name: /LN-\d{4}-\d{5}/ }).click();
  await expect(page).toHaveURL(/\/loans\/[a-z0-9]+$/);
  await expect(page.getByText("10,661.85").first()).toBeVisible();
});
