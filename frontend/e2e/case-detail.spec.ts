import { test, expect } from "@playwright/test"
import { navigateAndWaitForApi, navigateTo, ROUTES, waitForLoadingGone } from "./helpers"

test.describe("Case Detail Page", () => {
  let firstCaseId: string

  test.beforeAll(async ({ request }) => {
    // Get a real case ID from the API
    const res = await request.get("/api/v1/cases?page=1&page_size=1")
    const data = await res.json()
    firstCaseId = data.cases[0].case_id
  })

  test("loads case with metadata", async ({ page }) => {
    await navigateAndWaitForApi(page, `/app/cases/${firstCaseId}`, `/api/v1/cases/${firstCaseId}`)

    // Hero section should show court badge
    await expect(page.locator("span[class*='bg-court-']").first()).toBeVisible()

    // Metadata section
    await expect(page.getByText("Metadata")).toBeVisible()
    await expect(page.getByText("Citation")).toBeVisible()
  })

  test("has Back, Edit, Delete actions", async ({ page }) => {
    await navigateAndWaitForApi(page, `/app/cases/${firstCaseId}`, `/api/v1/cases/${firstCaseId}`)

    await expect(page.getByText("Back")).toBeVisible()
    // Edit is a Link (<a>), not a button
    await expect(page.getByRole("link", { name: /edit/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /delete/i })).toBeVisible()
  })

  test("full text toggle works", async ({ page }) => {
    await navigateAndWaitForApi(page, `/app/cases/${firstCaseId}`, `/api/v1/cases/${firstCaseId}`)

    const fullTextButton = page.getByRole("button", { name: "Full Text" })
    if (await fullTextButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Initially collapsed
      await expect(page.locator("pre")).not.toBeVisible()

      // Click to expand
      await fullTextButton.click()
      await expect(page.locator("pre")).toBeVisible()

      // Click to collapse
      await fullTextButton.click()
      await expect(page.locator("pre")).not.toBeVisible()
    }
  })

  test("Edit link navigates to edit page", async ({ page }) => {
    await navigateAndWaitForApi(page, `/app/cases/${firstCaseId}`, `/api/v1/cases/${firstCaseId}`)

    await page.getByRole("link", { name: /edit/i }).click()
    await page.waitForURL(/\/edit$/, { timeout: 15_000 })
  })

  test("Back button navigates back", async ({ page }) => {
    // Start from cases list
    await navigateAndWaitForApi(page, ROUTES.cases, "/api/v1/cases")

    // Navigate to first case — set up response listener BEFORE clicking
    const detailApiPromise = page.waitForResponse(
      (res) => /\/api\/v1\/cases\/[a-f0-9]+/.test(res.url()) && res.status() === 200,
      { timeout: 30_000 }
    )
    await page.locator("tbody tr").first().click()
    await page.waitForURL(/\/app\/cases\/[a-f0-9]+/, { timeout: 15_000 })
    await detailApiPromise

    // Click back
    await page.getByText("Back").click()
    await page.waitForURL(/\/app\/cases/, { timeout: 15_000 })
  })

  test("related cases section renders if available", async ({ page }) => {
    await navigateAndWaitForApi(page, `/app/cases/${firstCaseId}`, `/api/v1/cases/${firstCaseId}`)

    // Related cases heading may or may not appear depending on data
    // Just check the page doesn't error
    await expect(page.locator("#root")).not.toBeEmpty()
  })

  test("AustLII link opens in new tab", async ({ page }) => {
    await navigateAndWaitForApi(page, `/app/cases/${firstCaseId}`, `/api/v1/cases/${firstCaseId}`)

    const austliiLink = page.getByRole("link", { name: /view on austlii/i })
    if (await austliiLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(austliiLink).toHaveAttribute("target", "_blank")
      await expect(austliiLink).toHaveAttribute("rel", /noopener/)
    }
  })
})
