"""React SPA-specific fixtures.

Inherits base_url, seed_cases, browser from the parent tests/e2e/conftest.py.
Provides react_page, react_mobile, and react_url for React-specific E2E tests.
"""

import pytest


@pytest.fixture
def react_url(base_url):
    """Base URL for React SPA routes (appends /app to Flask base_url)."""
    return f"{base_url}/app"


@pytest.fixture
def react_page(browser, base_url):
    """Desktop browser page (1280x800) pre-configured for React SPA testing."""
    context = browser.new_context(
        viewport={"width": 1280, "height": 800},
        base_url=base_url,
        accept_downloads=True,
    )
    pg = context.new_page()
    pg._js_errors = []
    pg.on("pageerror", lambda err: pg._js_errors.append(str(err)))
    yield pg
    context.close()


@pytest.fixture
def react_mobile(browser, base_url):
    """Mobile browser page (390x844, iPhone-like) for React SPA testing."""
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        base_url=base_url,
    )
    pg = context.new_page()
    pg._js_errors = []
    pg.on("pageerror", lambda err: pg._js_errors.append(str(err)))
    yield pg
    context.close()


@pytest.fixture
def react_tablet(browser, base_url):
    """Tablet browser page (768x1024, iPad-like) for React SPA testing."""
    context = browser.new_context(
        viewport={"width": 768, "height": 1024},
        base_url=base_url,
    )
    pg = context.new_page()
    pg._js_errors = []
    pg.on("pageerror", lambda err: pg._js_errors.append(str(err)))
    yield pg
    context.close()
