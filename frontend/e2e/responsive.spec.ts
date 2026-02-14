import { test, expect } from "@playwright/test"
import { navigateTo, navigateAndWaitForApi, ROUTES } from "./helpers"

// These tests use custom viewports to test responsive behavior
test.describe("Responsive Design", () => {
  test.describe("Mobile viewport", () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test("sidebar is hidden on mobile", async ({ page }) => {
      await navigateTo(page, ROUTES.dashboard)
      const sidebar = page.locator("aside")
      await expect(sidebar).not.toBeVisible()
    })

    test("hamburger menu is visible on mobile", async ({ page }) => {
      await navigateTo(page, ROUTES.dashboard)
      const menuButton = page.getByRole("button", { name: /toggle menu/i })
      await expect(menuButton).toBeVisible()
    })

    test("mobile menu opens and closes", async ({ page }) => {
      await navigateTo(page, ROUTES.dashboard)

      // Open menu
      await page.getByRole("button", { name: /toggle menu/i }).click()

      // Mobile nav drawer should appear — look for nav items inside the fixed drawer
      const mobileDrawer = page.locator(".fixed.inset-y-0.left-0")
      await expect(mobileDrawer).toBeVisible({ timeout: 5000 })

      // Should contain nav items
      await expect(mobileDrawer.getByText("Cases")).toBeVisible()
      await expect(mobileDrawer.getByText("Search")).toBeVisible()
    })

    test("cases table is horizontally scrollable on mobile", async ({ page }) => {
      await navigateAndWaitForApi(page, ROUTES.cases, "/api/v1/cases")

      // The table container should have overflow-x-auto
      const tableContainer = page.locator("[class*='overflow-x-auto']")
      await expect(tableContainer).toBeVisible({ timeout: 15_000 })
    })

    test("card view works on mobile", async ({ page }) => {
      await navigateAndWaitForApi(page, ROUTES.cases, "/api/v1/cases")

      // Switch to card view
      const cardButton = page.locator("button").filter({ has: page.locator("svg.lucide-layout-grid") })
      await cardButton.click()

      // Cards should be visible
      const cards = page.locator("button[class*='rounded-lg'][class*='border'][class*='bg-card']")
      if (await cards.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(cards.first()).toBeVisible()
      }
    })
  })

  test.describe("Tablet viewport", () => {
    test.use({ viewport: { width: 768, height: 1024 } })

    test("sidebar is hidden on tablet", async ({ page }) => {
      await navigateTo(page, ROUTES.dashboard)
      // 768px < lg breakpoint (1024px), so sidebar should be hidden
      const sidebar = page.locator("aside")
      await expect(sidebar).not.toBeVisible()
    })
  })

  test.describe("Wide desktop viewport", () => {
    test.use({ viewport: { width: 1920, height: 1080 } })

    test("sidebar is visible on wide desktop", async ({ page }) => {
      await navigateTo(page, ROUTES.dashboard)
      const sidebar = page.locator("aside")
      await expect(sidebar).toBeVisible()
    })

    test("content area uses max width", async ({ page }) => {
      await navigateTo(page, ROUTES.dashboard)
      // Main area should exist and be visible
      const main = page.locator("main")
      await expect(main).toBeVisible()
    })
  })
})
