"""Reusable route constants and navigation utilities for E2E tests."""

# ---------------------------------------------------------------------------
# Route paths — React SPA routes (served at /)
# ---------------------------------------------------------------------------

SPA_ROUTES = [
    "/",
    "/cases",
    "/cases/add",
    "/cases/compare",
    "/analytics",
    "/judge-profiles",
    "/legislations",
    "/download",
    "/pipeline",
    "/jobs",
    "/data-dictionary",
    "/court-lineage",
]

# Routes that are functional API routes (return JSON)
FUNCTIONAL_API_ROUTES = [
    "/api/v1/job-status",
    "/api/v1/pipeline-status",
]

# Security headers expected on every response
EXPECTED_SECURITY_HEADERS = [
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Content-Security-Policy",
]


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def navigate(page, path):
    """Navigate to a path and wait for load."""
    page.goto(path, wait_until="networkidle")


def get_js_errors(page):
    """Return collected JS errors from the page."""
    return getattr(page, "_js_errors", [])


def has_element(page, selector):
    """Check if at least one element matches the selector."""
    return page.query_selector(selector) is not None


def count_elements(page, selector):
    """Count elements matching a selector."""
    return len(page.query_selector_all(selector))


def get_text(page, selector):
    """Get text content of first matching element."""
    el = page.query_selector(selector)
    return el.inner_text() if el else ""
