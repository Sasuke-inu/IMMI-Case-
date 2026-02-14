"""Reusable selectors, wait helpers, and navigation utilities for E2E tests."""

# ---------------------------------------------------------------------------
# CSS Selectors — centralised for maintainability
# ---------------------------------------------------------------------------

# Layout
SIDEBAR = ".immi-sidebar"
NAVBAR = ".immi-navbar"
MOBILE_NAV = ".mobile-nav"
MAIN_CONTENT = "#main-content"
SKIP_LINK = ".skip-link"

# Dashboard
STAT_CARDS = ".stat-card"
COURT_CHART = "#courtChart"
YEAR_CHART = "#yearChart"
QUICK_ACTIONS = ".card:has(.d-grid)"

# Case list
CASE_TABLE = ".table-cases"
CASE_ROWS = ".table-cases tbody tr[data-case-id]"
CASE_CARDS_MOBILE = ".case-card-mobile"
FILTER_BAR = ".filter-bar"
FILTER_FORM = "#filterForm"
FILTER_PILLS = ".filter-pill"
PAGINATION = "nav[aria-label='Pagination']"
EMPTY_STATE = ".empty-state"

# Batch operations
BATCH_BAR = "#batchBar"
SELECT_ALL = "#selectAll"
CASE_CHECKBOX = ".case-check"
BATCH_COUNT = "#batchCount"
BATCH_TAG_MODAL = "#batchTagModal"
BATCH_DELETE_MODAL = "#batchDeleteModal"

# Dark mode
THEME_TOGGLE = ".theme-toggle"
THEME_ICON = "#themeIcon"

# Global search
GLOBAL_SEARCH = "#globalSearch"
MOBILE_SEARCH_TOGGLE = ".mobile-search-toggle"
MOBILE_SEARCH_BAR = "#mobileSearchBar"

# Keyboard shortcuts
SHORTCUTS_MODAL = "#shortcutsModal"

# Forms
CSRF_TOKEN = "input[name='csrf_token']"

# Offcanvas
MOBILE_SIDEBAR = "#mobileSidebar"
OFFCANVAS_TOGGLER = ".navbar-toggler"


# ---------------------------------------------------------------------------
# Route paths
# ---------------------------------------------------------------------------

ROUTES = {
    "dashboard": "/",
    "cases": "/cases",
    "search": "/search",
    "download": "/download",
    "update_db": "/update-db",
    "pipeline": "/pipeline",
    "job_status": "/job-status",
    "case_add": "/cases/add",
    "data_dictionary": "/data-dictionary",
    "export_csv": "/export/csv",
    "export_json": "/export/json",
    "api_job_status": "/api/job-status",
    "api_pipeline_status": "/api/pipeline-status",
}

# All GET routes that should return 200 (excluding case-specific routes)
SMOKE_ROUTES = [
    "/",
    "/cases",
    "/search",
    "/download",
    "/update-db",
    "/pipeline",
    "/job-status",
    "/cases/add",
    "/data-dictionary",
]

# Security headers we expect on every response
# Note: X-XSS-Protection is intentionally NOT set (deprecated by modern browsers)
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


def wait_for_selector(page, selector, timeout=5000):
    """Wait for a selector and return the element."""
    return page.wait_for_selector(selector, timeout=timeout)


def count_elements(page, selector):
    """Count elements matching a selector."""
    return len(page.query_selector_all(selector))


def get_text(page, selector):
    """Get text content of first matching element."""
    el = page.query_selector(selector)
    return el.inner_text() if el else ""


def has_element(page, selector):
    """Check if at least one element matches the selector."""
    return page.query_selector(selector) is not None
