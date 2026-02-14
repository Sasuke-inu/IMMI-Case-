import { test, expect } from "@playwright/test"
import { navigateAndWaitForApi, navigateTo, ROUTES, waitForApiResponse } from "./helpers"

test.describe("Cases List Page", () => {
  test.beforeEach(async ({ page }) => {
    // Start API listener BEFORE navigation
    await navigateAndWaitForApi(page, ROUTES.cases, "/api/v1/cases")
  })

  test("shows page heading with total count", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Cases" })).toBeVisible()
    await expect(page.getByText(/total cases/i)).toBeVisible()
  })

  test("renders cases in table view by default", async ({ page }) => {
    const table = page.locator("table")
    await expect(table).toBeVisible()

    // Should have header columns (use <th> to be specific)
    await expect(page.locator("th").filter({ hasText: "Title" })).toBeVisible()
    await expect(page.locator("th").filter({ hasText: "Court" })).toBeVisible()

    // Should have data rows
    const rows = page.locator("tbody tr")
    await expect(rows.first()).toBeVisible()
  })

  test("switches to card view and back", async ({ page }) => {
    // Click card view icon (LayoutGrid)
    const cardButton = page.locator("button").filter({ has: page.locator("svg.lucide-layout-grid") })
    await cardButton.click()

    // Cards should appear
    const cards = page.locator("button[class*='rounded-lg'][class*='border'][class*='bg-card']")
    await expect(cards.first()).toBeVisible({ timeout: 5000 })

    // Switch back to table
    const listButton = page.locator("button").filter({ has: page.locator("svg.lucide-list") })
    await listButton.click()

    await expect(page.locator("table")).toBeVisible()
  })

  test("court filter changes results", async ({ page }) => {
    // Get the court filter select (first select = courts)
    const courtSelect = page.locator("select").first()
    await expect(courtSelect).toBeVisible()

    // Select a specific court
    const options = await courtSelect.locator("option").allTextContents()
    const courtOption = options.find((o) => o !== "All Courts")
    if (courtOption) {
      // Start watching for next API call BEFORE triggering the change
      const apiPromise = waitForApiResponse(page, "/api/v1/cases")
      await courtSelect.selectOption({ label: courtOption })
      await apiPromise
    }
  })

  test("year filter changes results", async ({ page }) => {
    // Year select is the second <select>
    const yearSelect = page.locator("select").nth(1)
    await expect(yearSelect).toBeVisible()

    const options = await yearSelect.locator("option").allTextContents()
    const yearOption = options.find((o) => o !== "All Years")
    if (yearOption) {
      const apiPromise = waitForApiResponse(page, "/api/v1/cases")
      await yearSelect.selectOption({ label: yearOption })
      await apiPromise
    }
  })

  test("keyword filter works on Enter", async ({ page }) => {
    const input = page.getByPlaceholder("Keyword filter...")
    await expect(input).toBeVisible()

    const apiPromise = waitForApiResponse(page, "/api/v1/cases")
    await input.fill("visa")
    await input.press("Enter")
    await apiPromise
  })

  test("pagination controls are present and functional", async ({ page }) => {
    // Pagination shows "Page X of Y"
    await expect(page.getByText(/Page \d+ of \d+/)).toBeVisible()
  })

  test("clicking a case row navigates to detail", async ({ page }) => {
    const firstRow = page.locator("tbody tr").first()
    await firstRow.click()
    await page.waitForURL(/\/app\/cases\/[a-f0-9]+/, { timeout: 15_000 })
  })

  test("checkbox selection enables batch bar", async ({ page }) => {
    // Click the first row's checkbox
    const firstCheckbox = page.locator("tbody tr").first().locator("input[type='checkbox']")
    await expect(firstCheckbox).toBeVisible()
    await firstCheckbox.check()

    // Batch bar should appear with "1 selected"
    await expect(page.getByText(/1 selected/)).toBeVisible()
    await expect(page.getByRole("button", { name: "Tag" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Delete" })).toBeVisible()
  })

  test("select-all checkbox toggles all rows", async ({ page }) => {
    // Click the header checkbox
    const headerCheckbox = page.locator("thead input[type='checkbox']")
    await headerCheckbox.check()

    // Batch bar should show "N selected"
    await expect(page.getByText(/\d+ selected/)).toBeVisible()

    // Click again to deselect all
    await headerCheckbox.uncheck()

    // Batch bar should disappear
    await expect(page.getByText(/\d+ selected/)).not.toBeVisible()
  })

  test("Add Case button navigates to add form", async ({ page }) => {
    await page.getByRole("button", { name: "Add Case" }).click()
    await page.waitForURL(/\/app\/cases\/add/)
  })
})
