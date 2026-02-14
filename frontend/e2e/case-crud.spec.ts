import { test, expect } from "@playwright/test"
import {
  navigateTo,
  navigateAndWaitForApi,
  ROUTES,
  waitForLoadingGone,
  createTestCase,
  deleteTestCase,
  readCaseWithRetry,
  uniqueTitle,
  expectToast,
  getCsrfToken,
} from "./helpers"

test.describe("Case CRUD", () => {
  // CRUD operations need more time — API under parallel load can be slow
  test.describe.configure({ timeout: 90_000 })

  // ─── Create ────────────────────────────────────────────────────
  test.describe("Create", () => {
    let createdId: string | null = null

    test.afterEach(async ({ request }) => {
      if (createdId) {
        await deleteTestCase(request, createdId).catch(() => {})
        createdId = null
      }
    })

    test("creates a new case via form", async ({ page, request }) => {
      await navigateTo(page, ROUTES.caseAdd)

      const title = uniqueTitle("Create-Test")

      // Fill Title field (first text input)
      const input = page.locator("input[type='text']").first()
      await input.fill(title)

      // Submit
      await page.getByRole("button", { name: /create/i }).click()

      // Should navigate to the new case detail page
      await page.waitForURL(/\/app\/cases\/[a-f0-9]+/, { timeout: 30_000 })

      // Extract the case ID from URL for cleanup
      const url = page.url()
      createdId = url.split("/cases/")[1]?.split("/")[0] ?? null

      // Wait for detail page content to load (not API response — it may already be done)
      await waitForLoadingGone(page)

      // Verify the title appears (can be slow under parallel load)
      await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 })
    })

    test("shows error when title is empty", async ({ page }) => {
      await navigateTo(page, ROUTES.caseAdd)

      // Submit without filling anything
      await page.getByRole("button", { name: /create/i }).click()

      // Toast error should appear
      await expectToast(page, /title is required/i)

      // Should NOT navigate away
      expect(page.url()).toContain("/cases/add")
    })

    test("Cancel button goes back", async ({ page }) => {
      await navigateAndWaitForApi(page, ROUTES.cases, "/api/v1/cases")
      await page.getByRole("button", { name: "Add Case" }).click()
      await page.waitForURL(/\/cases\/add/)

      await page.getByRole("button", { name: "Cancel" }).click()
      // Should go back to cases list
      await page.waitForURL(/\/app\/cases$/, { timeout: 15_000 })
    })
  })

  // ─── Edit ──────────────────────────────────────────────────────
  test.describe("Edit", () => {
    let testCaseId: string

    test.beforeAll(async ({ request }) => {
      const data = await createTestCase(request, {
        title: uniqueTitle("Edit-Test"),
        court: "Federal Court of Australia",
        court_code: "FCA",
        date: "2025-01-01",
      })
      testCaseId = data.case_id
    })

    test.afterAll(async ({ request }) => {
      await deleteTestCase(request, testCaseId).catch(() => {})
    })

    test("edits case fields and saves", async ({ page }) => {
      await navigateAndWaitForApi(page, `/app/cases/${testCaseId}/edit`, `/api/v1/cases/${testCaseId}`)

      // Should see "Edit Case" heading
      await expect(page.getByRole("heading", { name: /edit case/i })).toBeVisible()

      // Change the title
      const titleInput = page.locator("input[type='text']").first()
      const newTitle = uniqueTitle("Edited")
      await titleInput.fill(newTitle)

      // Save
      await page.getByRole("button", { name: /save/i }).click()

      // Should navigate to detail page
      await page.waitForURL(`/app/cases/${testCaseId}`, { timeout: 30_000 })
      await waitForLoadingGone(page)

      // Verify new title
      await expect(page.getByText(newTitle)).toBeVisible()
    })
  })

  // ─── Delete ────────────────────────────────────────────────────
  test.describe("Delete", () => {
    let testCaseId: string

    test.beforeEach(async ({ request }) => {
      const data = await createTestCase(request, {
        title: uniqueTitle("Delete-Test"),
        court_code: "AATA",
      })
      testCaseId = data.case_id
    })

    test("deletes case with confirmation", async ({ page }) => {
      await navigateAndWaitForApi(page, `/app/cases/${testCaseId}`, `/api/v1/cases/${testCaseId}`)

      // Set up dialog handler to accept the confirm dialog
      page.on("dialog", (dialog) => dialog.accept())

      await page.getByRole("button", { name: /delete/i }).click()

      // Should navigate back to cases list
      await page.waitForURL(/\/app\/cases$/, { timeout: 20_000 })
    })

    test("cancel delete keeps the case", async ({ page, request }) => {
      await navigateAndWaitForApi(page, `/app/cases/${testCaseId}`, `/api/v1/cases/${testCaseId}`)

      // Dismiss the confirm dialog
      page.on("dialog", (dialog) => dialog.dismiss())

      await page.getByRole("button", { name: /delete/i }).click()

      // Should still be on the same page
      expect(page.url()).toContain(testCaseId)

      // Clean up
      await deleteTestCase(request, testCaseId).catch(() => {})
    })
  })

  // ─── API-level CRUD ────────────────────────────────────────────
  test.describe("API CRUD", () => {
    test("full create-read-update-delete cycle via API", async ({ request }) => {
      const title = uniqueTitle("API-CRUD")

      // CREATE
      const created = await createTestCase(request, {
        title,
        court: "High Court of Australia",
        court_code: "HCA",
        date: "2025-06-15",
        visa_type: "protection",
      })
      expect(created.case_id).toBeTruthy()

      // READ (with retry — SQLite WAL visibility delay under parallel load)
      const readData = await readCaseWithRetry(request, created.case_id)
      expect(readData.case.title).toBe(title)

      // UPDATE
      const csrf = await getCsrfToken(request)
      const updateRes = await request.put(`/api/v1/cases/${created.case_id}`, {
        data: { title: `${title}-UPDATED` },
        headers: { "X-CSRFToken": csrf },
      })
      expect(updateRes.status()).toBe(200)

      // Verify update
      const verifyRes = await request.get(`/api/v1/cases/${created.case_id}`)
      const verifyData = await verifyRes.json()
      expect(verifyData.case.title).toContain("UPDATED")

      // DELETE
      await deleteTestCase(request, created.case_id)

      // Verify deleted
      const deletedRes = await request.get(`/api/v1/cases/${created.case_id}`)
      expect(deletedRes.status()).toBe(404)
    })
  })
})
