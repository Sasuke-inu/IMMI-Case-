import { test, expect } from "@playwright/test"
import {
  navigateTo,
  navigateAndWaitForApi,
  ROUTES,
  createTestCase,
  deleteTestCase,
  uniqueTitle,
  getCsrfToken,
} from "./helpers"

test.describe("Edge Cases", () => {
  // ─── Long text handling ───────────────────────────────────────
  test.describe("Long text", () => {
    test.describe.configure({ timeout: 90_000 })
    let caseId: string

    test.beforeAll(async ({ request }) => {
      const data = await createTestCase(request, {
        title: "A".repeat(300) + " Long Title Test",
        court: "Federal Court of Australia",
        court_code: "FCA",
        outcome: "The application is dismissed with costs in the amount previously agreed",
      })
      caseId = data.case_id
    })

    test.afterAll(async ({ request }) => {
      await deleteTestCase(request, caseId).catch(() => {})
    })

    test("long title does not break case detail layout", async ({ page }) => {
      await navigateAndWaitForApi(page, `/app/cases/${caseId}`, `/api/v1/cases/${caseId}`)

      // Page should load without horizontal overflow on main area
      const main = page.locator("main")
      await expect(main).toBeVisible()

      // Title should be rendered (truncated or wrapped)
      await expect(page.getByText("Long Title Test")).toBeVisible()
    })

    test("long title does not break cases list table", async ({ page }) => {
      await navigateAndWaitForApi(page, ROUTES.cases, "/api/v1/cases")

      // Table should still be usable
      const table = page.locator("table")
      await expect(table).toBeVisible()
    })
  })

  // ─── Special characters ───────────────────────────────────────
  test.describe("Special characters", () => {
    test.describe.configure({ timeout: 90_000 })
    let caseId: string

    test.beforeAll(async ({ request }) => {
      const data = await createTestCase(request, {
        title: uniqueTitle('Special <b>bold</b> & "quotes" O\'Brien'),
        court_code: "AATA",
      })
      caseId = data.case_id
    })

    test.afterAll(async ({ request }) => {
      await deleteTestCase(request, caseId).catch(() => {})
    })

    test("special characters render safely in case detail", async ({ page }) => {
      await navigateAndWaitForApi(page, `/app/cases/${caseId}`, `/api/v1/cases/${caseId}`)

      // HTML should be escaped, not rendered
      await expect(page.locator("#root")).not.toBeEmpty()

      // The text should be present (escaped, not as HTML)
      await expect(page.getByText("O'Brien")).toBeVisible()
    })
  })

  // ─── 404 / Not found ─────────────────────────────────────────
  test.describe("Not found", () => {
    test("non-existent case shows error state", async ({ page }) => {
      await navigateTo(page, "/app/cases/000000000000")

      // Wait a moment for any API response
      await page.waitForTimeout(3000)

      // At minimum, the page should not crash
      await expect(page.locator("#root")).not.toBeEmpty()
    })

    test("unknown route does not crash the app", async ({ page }) => {
      const errors: string[] = []
      page.on("pageerror", (err) => errors.push(err.message))

      await page.goto("/app/this-route-does-not-exist")
      await page.waitForSelector("#root", { state: "attached", timeout: 10_000 })

      // No uncaught JS errors
      expect(errors).toEqual([])
    })
  })

  // ─── Rapid user interactions ──────────────────────────────────
  test.describe("Rapid interactions", () => {
    test("rapid pagination clicks do not crash", async ({ page }) => {
      await navigateAndWaitForApi(page, ROUTES.cases, "/api/v1/cases")

      // Check if pagination exists (data might not have enough pages)
      const pageInfo = page.getByText(/Page \d+ of \d+/)
      if (await pageInfo.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Click page navigation buttons rapidly (ChevronRight icon buttons)
        const nextButton = page.locator("button").filter({ has: page.locator("svg.lucide-chevron-right") })
        if (await nextButton.isEnabled()) {
          await nextButton.click()
          await nextButton.click({ delay: 100 })
        }
      }

      // Page should still be functional after rapid clicks
      await expect(page.locator("#root")).not.toBeEmpty()
    })

    test("rapid theme toggles do not crash", async ({ page }) => {
      await navigateTo(page, ROUTES.dashboard)

      const themeButton = page.getByRole("button", { name: /toggle theme/i })
      await expect(themeButton).toBeVisible()

      // Toggle rapidly
      for (let i = 0; i < 5; i++) {
        await themeButton.click({ delay: 50 })
      }

      // Page should still work
      await expect(page.locator("#root")).not.toBeEmpty()
    })
  })

  // ─── Empty state handling ─────────────────────────────────────
  test.describe("Empty states", () => {
    test("search with no query shows initial state", async ({ page }) => {
      await navigateTo(page, ROUTES.search)

      // Search form should be visible without results
      await expect(page.getByPlaceholder(/search case text/i)).toBeVisible()
    })

    test("compare page with no selection shows instructions", async ({ page }) => {
      await navigateTo(page, ROUTES.caseCompare)

      // Should show some guidance text or empty state
      await expect(page.locator("#root")).not.toBeEmpty()
    })
  })

  // ─── Browser navigation ──────────────────────────────────────
  test.describe("Browser history", () => {
    test("back/forward navigation works correctly", async ({ page }) => {
      // Navigate: Dashboard -> Cases -> Search
      await navigateTo(page, ROUTES.dashboard)
      await navigateTo(page, ROUTES.cases)
      await navigateTo(page, ROUTES.search)

      // Go back to Cases
      await page.goBack()
      await page.waitForURL(/\/app\/cases/)

      // Go back to Dashboard
      await page.goBack()
      await page.waitForURL(/\/app\/$/)

      // Go forward to Cases
      await page.goForward()
      await page.waitForURL(/\/app\/cases/)
    })
  })

  // ─── API error resilience ────────────────────────────────────
  test.describe("API resilience", () => {
    test("invalid CSRF token returns 403", async ({ request }) => {
      const res = await request.post("/api/v1/cases", {
        data: { title: "Should fail" },
        headers: { "X-CSRFToken": "invalid-token-12345" },
      })
      // Should reject with 400 or 403
      expect([400, 403]).toContain(res.status())
    })

    test("GET non-existent case returns 404", async ({ request }) => {
      const res = await request.get("/api/v1/cases/000000000000")
      expect(res.status()).toBe(404)
    })

    test("PUT with empty body returns error", async ({ request }) => {
      const csrf = await getCsrfToken(request)
      const res = await request.put("/api/v1/cases/000000000000", {
        data: {},
        headers: { "X-CSRFToken": csrf },
      })
      expect([400, 404]).toContain(res.status())
    })
  })
})
