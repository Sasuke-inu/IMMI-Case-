"""Reusable route constants and navigation utilities for legacy E2E tests."""

# ---------------------------------------------------------------------------
# Route paths — legacy URLs and their React SPA targets
# ---------------------------------------------------------------------------

LEGACY_REDIRECT_MAP = {
    "/": "/app/",
    "/cases": "/app/cases",
    "/cases/add": "/app/cases/add",
    "/cases/compare": "/app/cases/compare",
    "/search": "/app/download",
    "/download": "/app/download",
    "/update-db": "/app/pipeline",
    "/pipeline": "/app/pipeline",
    "/job-status": "/app/jobs",
    "/data-dictionary": "/app/data-dictionary",
}

# Routes that are functional (non-redirect) and should still return 200
FUNCTIONAL_API_ROUTES = [
    "/api/job-status",
    "/api/pipeline-status",
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
