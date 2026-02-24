# IMMI-Case Improvement Plan

> **Status Update (2026-02-23):**
> - **Webapp Split (Phase 3):** ✅ COMPLETE. Logic moved to `immi_case_downloader/web/` with Blueprints.
> - **CaseRepository (Phase 4):** ✅ COMPLETE. Repository pattern implemented and in use.
> - **Frontend:** React SPA is the primary UI. Legacy Jinja2 routes redirect to React.
> - **Critical Focus:** E2E Test stability (33 failures due to ambiguous selectors) and Security Hardening.

---

## Roadmap Overview

- [x] **Phase 3: Webapp Split** (Completed)
- [x] **Phase 4: Data Layer Refactor** (Completed)
- [ ] **Phase 0: Security Hardening** (In Progress - warnings remain)
- [ ] **Phase 1: Stability & Thread Safety** (In Progress - JobManager pending)
- [ ] **Phase 2: Test Infrastructure** (High Priority - E2E fixes)
- [ ] **Phase 5: Scraper Unification** (Pending)
- [ ] **Phase 6: Pipeline Improvement** (Pending)
- [ ] **Phase 7: Performance Optimization** (Pending)
- [ ] **Phase 8: Full Test Coverage** (Ongoing - Target 80%)

---

## Phase 0: Security Hardening

**Status:** Partial. `RuntimeWarning: SECRET_KEY not set!` visible in logs.

### Remaining Tasks
1.  **Enforce Secret Key:** Ensure `SECRET_KEY` is loaded from `.env` in production and tests. Update `tests/conftest.py` to suppress warnings or provide a key.
2.  **CSRF Verification:** Double-check CSRF protection on the React API endpoints (`/api/v1/*`).
3.  **Secure Headers:** Verify `Secure`, `HttpOnly`, `SameSite` flags on cookies.

---

## Phase 1: Stability & Thread Safety

**Status:** Partial. `_job_status` in `web/jobs.py` uses a lock, but global state is still mutable.

### Remaining Tasks
1.  **JobManager Class:** Refactor `_job_status` dictionary into a proper `JobManager` class (Singleton) to encapsulate state and locking logic.
2.  **Input Validation:** Ensure all API inputs (pagination, search queries) are strictly validated using `safe_int` / `safe_float`.

---

## Phase 2: Test Infrastructure (URGENT)

**Status:** Critical Failures. 33 E2E tests failing due to Playwright Strict Mode violations.

### Immediate Action Items
1.  **Fix Ambiguous Selectors:** Update `tests/e2e/react/react_helpers.py` and test files to use specific locators (e.g., `get_by_role('button', name='Save')` instead of `get_by_text('Save')`).
2.  **Stabilize Navigation:** Fix timeout issues in sidebar navigation tests.
3.  **Theme Toggle Test:** Fix visibility assertion for the theme toggle button.

---

## Phase 5: Scraper Unification

**Status:** Pending. `AustLIIScraper` and `FederalCourtScraper` have divergent interfaces.

### Tasks
1.  **CaseScraper Protocol:** Define a formal `CaseScraper` protocol.
2.  **Unified Metadata Extraction:** Merge regex logic from `austlii.py`, `federal_court.py`, and `postprocess.py` into a single `MetadataExtractor` service.

---

## Phase 6: Pipeline Improvement

**Status:** Pending. `pipeline.py` exists but relies on some global state.

### Tasks
1.  **State Encapsulation:** Move `_pipeline_status` into the `SmartPipeline` class instance.
2.  **Config Management:** Fully decouple configuration from `Flask` request objects (already partially done via `PipelineConfig`).

---

## Phase 7: Performance Optimization

**Status:** Pending.

### Tasks
1.  **Caching:** Implement caching for "Dashboard Stats" and "Analytics" endpoints (expensive aggregations).
2.  **Rate Limiting:** Add `flask-limiter` for API endpoints (e.g., login, search).

---

## Phase 8: Full Test Coverage

**Target:** 80% Coverage (Currently ~73% on backend, but E2E needs work).

### Focus Areas
1.  **Frontend/E2E:** Fix the 33 failing tests.
2.  **Edge Cases:** Add tests for malformed scraped HTML and network timeouts.

---

## Ralph Loop: E2E Test Fixes (Immediate)

```markdown
# PROMPT.md — Phase 2-Fix: E2E Test Stabilization

## Context
33 E2E tests are failing due to Playwright Strict Mode violations (ambiguous selectors) and timeouts.

## Task
1.  **Analyze Failures:** Review `pytest` output for specific selector ambiguities.
    *   `get_by_text("Save Search")` -> matches button AND helper text.
    *   `get_by_text("Dashboard")` -> matches link AND heading.
    *   `get_by_text("Scrape AustLII")` -> timeout.
2.  **Refactor Selectors:** Update `tests/e2e/react/` files to use robust locators:
    *   `get_by_role("button", name="...")`
    *   `get_by_role("link", name="...", exact=True)`
    *   `get_by_role("heading", name="...")`
3.  **Fix Navigation:** Ensure sidebar navigation tests wait for stability before clicking.
4.  **Verify:** Run `python3 -m pytest tests/e2e/react/` until all pass.

## Completion
Output <promise>E2E TESTS FIXED</promise> when `pytest` reports 0 failures for the E2E suite.
```