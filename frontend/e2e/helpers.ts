import { type Page, type APIRequestContext, expect } from "@playwright/test"

// ─── Routes ────────────────────────────────────────────────────────
export const ROUTES = {
  dashboard: "/app/",
  cases: "/app/cases",
  caseAdd: "/app/cases/add",
  caseCompare: "/app/cases/compare",
  search: "/app/search",
  download: "/app/download",
  updateDb: "/app/update-db",
  jobs: "/app/jobs",
  pipeline: "/app/pipeline",
  dataDictionary: "/app/data-dictionary",
  designTokens: "/app/design-tokens",
} as const

export const ALL_PAGES = Object.entries(ROUTES)

// ─── Navigation helpers ────────────────────────────────────────────

/** Navigate to a path and wait for React to mount. */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path)
  await waitForReact(page)
}

/**
 * Navigate and wait for a specific API response.
 * Starts the response listener BEFORE navigation to avoid race conditions.
 */
export async function navigateAndWaitForApi(
  page: Page,
  path: string,
  urlPattern: string | RegExp
) {
  const apiPromise = page.waitForResponse(
    (res) =>
      (typeof urlPattern === "string"
        ? res.url().includes(urlPattern)
        : urlPattern.test(res.url())) && res.status() === 200,
    { timeout: 50_000 }
  )
  await page.goto(path)
  await apiPromise
  await waitForReact(page)
}

export async function waitForReact(page: Page) {
  await page.waitForSelector("#root > *", { state: "attached", timeout: 15_000 })
}

/** Wait for any visible "Loading" text to disappear. */
export async function waitForLoadingGone(page: Page) {
  const loader = page.getByText("Loading", { exact: false })
  if (await loader.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loader.waitFor({ state: "hidden", timeout: 50_000 })
  }
}

/**
 * Wait for a specific API response (use AFTER navigateTo if the API call
 * is triggered by a user action on the page, not by navigation).
 */
export async function waitForApiResponse(page: Page, urlPattern: string | RegExp) {
  return page.waitForResponse(
    (res) =>
      (typeof urlPattern === "string"
        ? res.url().includes(urlPattern)
        : urlPattern.test(res.url())) && res.status() === 200,
    { timeout: 50_000 }
  )
}

// ─── CSRF & API helpers ────────────────────────────────────────────
export async function getCsrfToken(request: APIRequestContext): Promise<string> {
  const res = await request.get("/api/v1/csrf-token")
  const data = await res.json()
  return data.csrf_token
}

interface TestCaseData {
  title: string
  citation?: string
  court?: string
  court_code?: string
  date?: string
  outcome?: string
  visa_type?: string
  case_nature?: string
  source?: string
}

export async function createTestCase(
  request: APIRequestContext,
  data: TestCaseData,
  retries = 3
): Promise<{ case_id: string } & TestCaseData> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const csrf = await getCsrfToken(request)
    const res = await request.post("/api/v1/cases", {
      data,
      headers: { "X-CSRFToken": csrf },
    })
    if (res.status() === 200 || res.status() === 201) {
      return res.json()
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 1000 * attempt))
    } else {
      expect([200, 201]).toContain(res.status())
    }
  }
  throw new Error("createTestCase: unreachable")
}

export async function deleteTestCase(
  request: APIRequestContext,
  id: string
): Promise<void> {
  const csrf = await getCsrfToken(request)
  await request.delete(`/api/v1/cases/${id}`, {
    headers: { "X-CSRFToken": csrf },
  })
}

/** GET a case with retry — SQLite WAL can have brief visibility delays under load. */
export async function readCaseWithRetry(
  request: APIRequestContext,
  caseId: string,
  retries = 3
): Promise<{ case: Record<string, unknown>; full_text: string }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await request.get(`/api/v1/cases/${caseId}`)
    if (res.status() === 200) return res.json()
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 1000 * attempt))
    } else {
      expect(res.status()).toBe(200)
    }
  }
  throw new Error("readCaseWithRetry: unreachable")
}

// ─── Unique test data ──────────────────────────────────────────────
let counter = 0
export function uniqueTitle(prefix = "E2E-Test") {
  counter++
  return `${prefix}-${Date.now()}-${counter}`
}

// ─── Sidebar navigation (desktop only) ─────────────────────────────
export const SIDEBAR_ITEMS = [
  { label: "Dashboard", path: "/app/" },
  { label: "Cases", path: "/app/cases" },
  { label: "Search", path: "/app/search" },
  { label: "Download", path: "/app/download" },
  { label: "Update DB", path: "/app/update-db" },
  { label: "Pipeline", path: "/app/pipeline" },
  { label: "Data Dictionary", path: "/app/data-dictionary" },
  { label: "Design Tokens", path: "/app/design-tokens" },
]

export async function clickSidebarLink(page: Page, label: string) {
  const sidebar = page.locator("aside")
  await sidebar.getByText(label, { exact: true }).click()
  await waitForReact(page)
}

// ─── Toast helper ──────────────────────────────────────────────────
export async function expectToast(page: Page, textMatch: string | RegExp) {
  const toast = page.locator("[data-sonner-toast]").first()
  await toast.waitFor({ state: "visible", timeout: 5_000 })
  await expect(toast).toContainText(textMatch)
}
