import { expect, test } from "@playwright/test";
import { open, ownerPassword, signIn, viewerPassword } from "./helpers";

test("dashboard shows the headline figures", async ({ page }) => {
  await signIn(page, "admin", ownerPassword);
  for (const text of [
    "Sales",
    "Collection",
    "Total receivable",
    "Total payable",
    "This fiscal year by month",
    "Account balances",
  ]) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  }
});

test("core reports render, balance, and export", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, "admin", ownerPassword);

  await open(page, "/reports/accounting");
  await expect(page.getByRole("heading", { name: "Trial Balance" })).toBeVisible();
  await expect(page.getByText("Balanced", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Balance Sheet" }).click();
  await expect(page).toHaveURL(/report=balance-sheet/);
  await expect(page.getByText("Total liabilities and equity")).toBeVisible();
  await expect(page.getByText("Balanced", { exact: true })).toBeVisible();

  await open(page, "/reports/profitloss");
  await expect(page.getByRole("heading", { name: "Profit & Loss", exact: true })).toBeVisible();
  await expect(page.getByText(/Net (profit|loss)/).first()).toBeVisible();

  await open(page, "/reports/sales?from=2020-01-01");
  await expect(page.getByRole("heading", { name: "Sales Report", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^AIT-\d{4}-\d{5}$/ }).first()).toBeVisible();

  await open(page, "/reports/due?party=vendors");
  await expect(page.getByRole("heading", { name: "Vendors: Due & Advance" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Skyline Air Consolidators" })).toBeVisible();

  // Ledger: pick a client, then the statement appears.
  await open(page, "/reports/ledgers");
  await expect(page.getByText("Choose a client to see the ledger.")).toBeVisible();
  await page.locator("#report_partyId").click();
  await page.locator("#report_partyId").fill("Abdul");
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option")
    .filter({ hasText: "Abdul Karim" })
    .click();
  await expect(page).toHaveURL(/partyId=/);
  await expect(page.getByRole("heading", { name: /Client Ledger: Abdul Karim/ })).toBeVisible();

  // Exports.
  const pdfHref = await page.getByRole("link", { name: "Print / PDF" }).getAttribute("href");
  const pdf = await page.request.get(pdfHref!);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  const xlsx = await page.request.get(pdfHref!.replace("format=pdf", "format=xlsx"));
  expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
  expect((await xlsx.body()).subarray(0, 2).toString()).toBe("PK"); // a zip, as .xlsx files are
});

test("a past month can be closed and reopened", async ({ page }) => {
  await signIn(page, "admin", ownerPassword);
  await open(page, "/accounts");
  await page.getByRole("tab", { name: "Closed months" }).click();
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("button", { name: "Close" }) })
    .first();
  await row.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "OK" }).click();
  await expect(page.getByText(/ closed$/)).toBeVisible();
  const closedRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("button", { name: "Reopen" }) })
    .first();
  await closedRow.getByRole("button", { name: "Reopen" }).click();
  await page.getByRole("button", { name: "OK" }).click();
  await expect(page.getByText(/ reopened$/)).toBeVisible();
});

test("viewer can read reports but not export them", async ({ page }) => {
  await signIn(page, "viewer", viewerPassword);
  await open(page, "/reports/profitloss");
  await expect(page.getByRole("heading", { name: "Profit & Loss", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Excel" })).toHaveCount(0);
  const denied = await page.request.get("/api/reports/profit-loss?format=xlsx");
  expect(denied.status()).toBe(403);
});

test("report groups: pick a report, filter by period, export", async ({ page }) => {
  await signIn(page, "admin", ownerPassword);
  await open(page, "/reports/airticket?from=2020-01-01");
  await expect(page.getByRole("heading", { name: "Ticket Details", exact: true })).toBeVisible();
  await page.locator('.ant-select:has(input[aria-label="Report"])').click();
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option")
    .filter({ hasText: "Tax Report" })
    .click();
  await expect(page).toHaveURL(/report=tax-report/);
  await expect(page.getByRole("heading", { name: "Tax Report", exact: true })).toBeVisible();

  await open(page, "/reports/other?report=daily-summary&from=2020-01-01");
  await expect(page.getByRole("heading", { name: "Daily Summary", exact: true })).toBeVisible();
  const pdfHref = await page.getByRole("link", { name: "Print / PDF" }).getAttribute("href");
  expect(pdfHref).toContain("/api/reports/daily-summary");
  const xlsx = await page.request.get(pdfHref!.replace("format=pdf", "format=xlsx"));
  expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");

  await open(page, "/reports/other?report=audit-trail");
  await expect(page.getByRole("heading", { name: "Audit Trail", exact: true })).toBeVisible();
});
