# E2E Test Suite

Playwright-based end-to-end tests for the IMMI-Case React SPA frontend.

## Quick Start

```bash
cd frontend

# Run all tests (headless)
npm run e2e

# Run with Playwright UI (interactive debugging)
npm run e2e:ui

# Run with visible browser
npm run e2e:headed
```

## Architecture

```
e2e/
  helpers.ts            # Shared utilities, routes, API helpers, retry logic
  smoke.spec.ts         # Page load verification + API health checks
  dashboard.spec.ts     # Dashboard stats, charts, court breakdown
  cases-list.spec.ts    # Table/card view, filters, pagination, batch ops
  case-detail.spec.ts   # Detail page, related cases, back navigation
  case-crud.spec.ts     # Create/Edit/Delete via form + full API CRUD cycle
  search.spec.ts        # Full-text search, metadata search
  navigation.spec.ts    # Sidebar nav, theme toggle (desktop only)
  responsive.spec.ts    # Mobile drawer, touch targets, viewport layouts
  edge-cases.spec.ts    # Long text, special chars, 404, rapid interactions, API resilience
```

## Test Projects

| Project   | Viewport         | Notes                          |
| --------- | ---------------- | ------------------------------ |
| `desktop` | Desktop Chrome   | Full sidebar visible           |
| `mobile`  | iPhone 14        | Hamburger menu, drawer sidebar |

## Configuration

Key settings in `playwright.config.ts`:

| Setting           | Value  | Reason                                    |
| ----------------- | ------ | ----------------------------------------- |
| `workers`         | 2      | Flask+SQLite cannot handle heavy parallel  |
| `fullyParallel`   | false  | Serial within each spec file               |
| `retries`         | 1      | Handles transient SQLite load issues       |
| `timeout`         | 60s    | Large dataset (62K records) = slow queries |
| `expect.timeout`  | 15s    | API-dependent assertions need more time    |

## Helpers (`helpers.ts`)

### Navigation
- `navigateTo(page, path)` - Navigate and wait for React mount
- `navigateAndWaitForApi(page, path, urlPattern)` - Navigate with API response wait (50s timeout, listener starts BEFORE navigation)
- `waitForLoadingGone(page)` - Wait for "Loading" text to disappear
- `clickSidebarLink(page, label)` - Click sidebar nav item (desktop only)

### API
- `getCsrfToken(request)` - Fetch CSRF token for mutations
- `createTestCase(request, data, retries?)` - Create test case with retry logic (handles SQLite 500s)
- `deleteTestCase(request, id)` - Clean up test data
- `readCaseWithRetry(request, id, retries?)` - GET case with retry (handles WAL visibility delays)

### Data
- `uniqueTitle(prefix?)` - Generate unique title with timestamp + counter
- `ROUTES` - All SPA route paths
- `SIDEBAR_ITEMS` - Sidebar navigation labels and paths

## Writing New Tests

### Pattern: API-dependent page

```typescript
test("shows data after loading", async ({ page }) => {
  // Start listener BEFORE navigation to avoid race condition
  await navigateAndWaitForApi(page, ROUTES.cases, "/api/v1/cases")

  // Now assert on the loaded content
  await expect(page.locator("table")).toBeVisible()
})
```

### Pattern: Test data with cleanup

```typescript
test.describe("My feature", () => {
  let caseId: string

  test.beforeAll(async ({ request }) => {
    const data = await createTestCase(request, {
      title: uniqueTitle("MyTest"),
      court_code: "FCA",
    })
    caseId = data.case_id
  })

  test.afterAll(async ({ request }) => {
    await deleteTestCase(request, caseId).catch(() => {})
  })

  test("does something with the case", async ({ page }) => {
    await navigateAndWaitForApi(page, `/app/cases/${caseId}`, `/api/v1/cases/${caseId}`)
    // ...
  })
})
```

### Pattern: Mobile-only skip

```typescript
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Not applicable on mobile")
})
```

## Troubleshooting

### Tests fail under parallel load
The Flask+SQLite backend with 62K records is the bottleneck. If tests fail intermittently:
- Reduce `workers` in config (minimum: 1)
- The built-in retry (`retries: 1`) handles most transient failures
- `createTestCase` has internal retry logic for HTTP 500 (database locked)

### "Loading case..." timeout
The `/api/v1/stats` endpoint scans 62K records and can take 10-25s. Under parallel load, other API calls queue behind it. The `navigateAndWaitForApi` helper has a 50s timeout to accommodate this.

### Flaky tests
Tests marked "flaky" by Playwright passed on retry. This is expected behavior with SQLite under concurrent access. Zero-failure runs are common but not guaranteed on every invocation.

### Web server not starting
The config auto-starts `python web.py --port 8080 --backend sqlite`. Ensure:
- Port 8080 is free (macOS AirPlay uses 5000)
- Python dependencies are installed (`pip install -r requirements.txt`)
- `downloaded_cases/` directory exists with data
