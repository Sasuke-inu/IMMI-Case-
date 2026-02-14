import { test, expect } from "@playwright/test"
import { navigateTo, navigateAndWaitForApi, ROUTES, waitForReact, SIDEBAR_ITEMS, clickSidebarLink } from "./helpers"

test.describe("Navigation", () => {
  test.describe("Desktop sidebar", () => {
    test.beforeEach(async ({}, testInfo) => {
      test.skip(testInfo.project.name === "mobile", "Sidebar is hidden on mobile")
    })

    test("sidebar shows all nav items", async ({ page }) => {
      await navigateTo(page, ROUTES.dashboard)

      const sidebar = page.locator("aside")
      await expect(sidebar).toBeVisible()

      for (const { label } of SIDEBAR_ITEMS) {
        await expect(sidebar.getByText(label, { exact: true })).toBeVisible()
      }
    })

    test("sidebar highlights active route", async ({ page }) => {
      await navigateAndWaitForApi(page, ROUTES.cases, "/api/v1/cases")

      const sidebar = page.locator("aside")
      const casesLink = sidebar.getByText("Cases", { exact: true })
      // Active link should have accent color class
      const parent = casesLink.locator("..")
      await expect(parent).toHaveClass(/text-accent/)
    })

    test("clicking sidebar items navigates correctly", async ({ page }) => {
      await navigateTo(page, ROUTES.dashboard)

      // Navigate to Search via sidebar (lightweight — no heavy API call)
      await clickSidebarLink(page, "Search")
      await page.waitForURL(/\/app\/search/, { timeout: 20_000 })

      // Navigate to Data Dictionary (also lightweight)
      await clickSidebarLink(page, "Data Dictionary")
      await page.waitForURL(/\/app\/data-dictionary/, { timeout: 20_000 })

      // Navigate back to Dashboard
      await clickSidebarLink(page, "Dashboard")
      await page.waitForURL(/\/app\/?$/, { timeout: 20_000 })
    })

    test("IMMI-Case logo is visible", async ({ page }) => {
      await navigateTo(page, ROUTES.dashboard)
      await expect(page.getByText("IMMI-Case")).toBeVisible()
    })
  })

  test.describe("Theme toggle", () => {
    test("toggles between light and dark theme", async ({ page }) => {
      await navigateTo(page, ROUTES.dashboard)

      const themeButton = page.getByRole("button", { name: /toggle theme/i })
      await expect(themeButton).toBeVisible()

      // Get initial theme via classList
      const initialIsDark = await page.evaluate(() =>
        document.documentElement.classList.contains("dark")
      )

      // Toggle
      await themeButton.click()

      // Theme should have changed
      const newIsDark = await page.evaluate(() =>
        document.documentElement.classList.contains("dark")
      )
      expect(newIsDark).not.toBe(initialIsDark)

      // Toggle back
      await themeButton.click()
      const restoredIsDark = await page.evaluate(() =>
        document.documentElement.classList.contains("dark")
      )
      expect(restoredIsDark).toBe(initialIsDark)
    })
  })
})
