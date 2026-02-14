import { test, expect } from "@playwright/test"
import { navigateTo, ROUTES } from "./helpers"

test.describe("Search Page", () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.search)
  })

  test("shows search heading and form", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: "Search" })).toBeVisible()
    await expect(page.getByText("Full-Text Search")).toBeVisible()
    await expect(
      page.getByPlaceholder(/search case text/i)
    ).toBeVisible()
  })

  test("performs full-text search", async ({ page }) => {
    const input = page.getByPlaceholder(/search case text/i)
    await input.fill("protection visa")

    await page.getByRole("button", { name: "Search", exact: true }).click()

    // Wait for results — format: "N results for "query""
    await expect(page.getByText(/\d+ results? for/i)).toBeVisible({ timeout: 20_000 })
  })

  test("shows result count and case entries", async ({ page }) => {
    const input = page.getByPlaceholder(/search case text/i)
    await input.fill("refugee")
    await page.getByRole("button", { name: "Search", exact: true }).click()

    await expect(page.getByText(/\d+ results? for/i)).toBeVisible({ timeout: 20_000 })

    // Should have result items with court badges
    const results = page.locator("span[class*='bg-court-']")
    await expect(results.first()).toBeVisible()
  })

  test("clicking a search result navigates to case detail", async ({ page }) => {
    const input = page.getByPlaceholder(/search case text/i)
    await input.fill("visa")
    await page.getByRole("button", { name: "Search", exact: true }).click()

    await expect(page.getByText(/\d+ results? for/i)).toBeVisible({ timeout: 20_000 })

    // Click first result button (has court badge inside)
    const firstResult = page
      .locator("button")
      .filter({ has: page.locator("span[class*='bg-court-']") })
      .first()
    if (await firstResult.isVisible()) {
      await firstResult.click()
      await page.waitForURL(/\/app\/cases\/[a-f0-9]+/, { timeout: 15_000 })
    }
  })

  test("empty search shows no results message", async ({ page }) => {
    const input = page.getByPlaceholder(/search case text/i)
    await input.fill("xyznonexistent99999")
    await page.getByRole("button", { name: "Search", exact: true }).click()

    await expect(page.getByText(/0 results? for/i)).toBeVisible({ timeout: 20_000 })
  })

  test("scrape section shows database fields", async ({ page }) => {
    await expect(page.getByText("Scrape New Cases")).toBeVisible()
    await expect(page.getByText("Databases")).toBeVisible()
    await expect(page.getByText("Start Year")).toBeVisible()
    await expect(page.getByText("End Year")).toBeVisible()
  })
})
