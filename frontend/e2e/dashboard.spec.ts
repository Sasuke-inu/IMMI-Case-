import { test, expect } from "@playwright/test"
import { navigateAndWaitForApi, ROUTES } from "./helpers"

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    // Start API listener BEFORE navigation to avoid race conditions
    await navigateAndWaitForApi(page, ROUTES.dashboard, "/api/v1/stats")
  })

  test("shows heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
  })

  test("displays case statistics", async ({ page }) => {
    await expect(page.getByText("Total Cases")).toBeVisible()
    await expect(page.getByText("With Full Text")).toBeVisible()
  })

  test("displays court distribution chart", async ({ page }) => {
    await expect(page.getByText("Cases by Court")).toBeVisible()
  })

  test("recent cases section shows cases", async ({ page }) => {
    // Recent cases section should be visible if data exists
    const recentSection = page.getByText("Recent Cases")
    if (await recentSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(recentSection).toBeVisible()
      // Should have court badges inside recent cases
      const badges = page.locator("span[class*='bg-court-']")
      await expect(badges.first()).toBeVisible()
    }
  })

  test("clicking a recent case navigates to detail", async ({ page }) => {
    const recentSection = page.getByText("Recent Cases")
    if (await recentSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Click the first case in the recent list
      const caseButton = page
        .locator("button")
        .filter({ has: page.locator("span[class*='bg-court-']") })
        .first()
      if (await caseButton.isVisible()) {
        await caseButton.click()
        await page.waitForURL(/\/app\/cases\/[a-f0-9]+/, { timeout: 20_000 })
      }
    }
  })
})
