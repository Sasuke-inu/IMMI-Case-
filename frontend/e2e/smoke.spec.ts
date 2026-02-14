import { test, expect } from "@playwright/test"
import { ALL_PAGES, waitForReact } from "./helpers"

test.describe("Smoke Tests", () => {
  for (const [name, path] of ALL_PAGES) {
    test(`${name} page loads without errors`, async ({ page }) => {
      const errors: string[] = []
      page.on("pageerror", (err) => errors.push(err.message))

      await page.goto(path)
      await waitForReact(page)

      // Page should not show a blank screen
      const root = page.locator("#root")
      await expect(root).not.toBeEmpty()

      // No uncaught JS errors
      expect(errors).toEqual([])
    })
  }

  test("API health: /api/v1/stats responds 200", async ({ request }) => {
    // Stats is slow with 62K records — allow extra time
    const res = await request.get("/api/v1/stats")
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty("total_cases")
  })

  test("API health: /api/v1/csrf-token responds 200", async ({ request }) => {
    const res = await request.get("/api/v1/csrf-token")
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty("csrf_token")
  })

  test("API health: /api/v1/cases responds with pagination", async ({ request }) => {
    const res = await request.get("/api/v1/cases?page=1&page_size=5")
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty("cases")
    expect(data).toHaveProperty("total")
    expect(data).toHaveProperty("total_pages")
    expect(data.cases.length).toBeGreaterThan(0)
  })

  test("API health: /api/v1/filter-options responds 200", async ({ request }) => {
    const res = await request.get("/api/v1/filter-options")
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty("courts")
    expect(data).toHaveProperty("years")
  })

  test("API health: /api/v1/data-dictionary responds 200", async ({ request }) => {
    const res = await request.get("/api/v1/data-dictionary")
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty("fields")
  })
})
