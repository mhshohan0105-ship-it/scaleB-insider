import { expect, test } from "@playwright/test";
import { choose, open, ownerPassword, signIn, viewerPassword } from "./helpers";

test("add a bank account, transfer to cash with a charge, then void it", async ({ page }) => {
  const bank = `E2E Bank ${Date.now()}`;
  await signIn(page, "admin", ownerPassword);

  await open(page, "/accounts");
  await page.getByRole("button", { name: "Add Account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Account name").fill(bank);
  await dialog.getByLabel("Account / wallet number").fill("9988776655");
  await dialog.getByLabel("Opening balance").fill("5000");
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Account added")).toBeVisible();
  const accountRow = page.getByRole("row", { name: new RegExp(bank) });
  await expect(accountRow.getByText("5,000.00")).toBeVisible();
  await expect(accountRow.getByText("••••6655")).toBeVisible();

  await open(page, "/accounts/balancetransfer");
  await choose(page, "From account", bank, bank);
  await choose(page, "To account", "Cash in Hand", "Cash in Hand");
  await page.getByLabel("Amount").fill("1000");
  await page.getByLabel("Charge").fill("10");
  await expect(page.getByText(/will go from 5,000.00 to/)).toContainText("3,990.00");
  await page.getByRole("button", { name: "Transfer", exact: true }).click();
  await expect(page.getByText(/Transfer BT-\d{4}-\d{5} saved/)).toBeVisible();
  const transferRow = page.getByRole("row", { name: new RegExp(`${bank} → Cash in Hand`) }).first();
  await expect(transferRow.getByText("Posted")).toBeVisible();

  // Statement for the bank account shows the outgoing line and running balance.
  await open(page, "/accounts");
  await page.getByRole("link", { name: bank }).click();
  await expect(page).toHaveURL(/\/accounts\/transactions\?account=/);
  const line = page.getByRole("row", { name: /Balance transfer BT-/ }).first();
  await expect(line.getByText("1,010.00")).toBeVisible();
  await expect(line.getByText("3,990.00")).toBeVisible();

  await open(page, "/accounts/balancetransfer");
  await transferRow.getByRole("button", { name: "Void" }).click();
  await page.getByRole("dialog").getByLabel("Reason").fill("Wrong account");
  await page.getByRole("button", { name: "Void transfer" }).click();
  await expect(page.getByText("Transfer voided")).toBeVisible();
  await expect(transferRow.getByText("Void", { exact: true })).toBeVisible();

  await open(page, "/accounts/balancestatus");
  await expect(page.getByRole("link", { name: bank })).toBeVisible();
  await expect(
    page.locator(".ant-list-item").filter({ hasText: bank }).getByText("5,000.00"),
  ).toBeVisible();
});

test("viewer sees accounts but cannot add or transfer", async ({ page }) => {
  await signIn(page, "viewer", viewerPassword);
  await open(page, "/accounts");
  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Account" })).toHaveCount(0);
  await open(page, "/accounts/balancetransfer");
  await expect(page.getByText("Transfer history")).toBeVisible();
  await expect(page.getByRole("button", { name: "Transfer", exact: true })).toHaveCount(0);
});
