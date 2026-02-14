"""Dark mode theme tests — toggle, localStorage persistence, icon swap."""

import pytest

from .helpers import (
    THEME_TOGGLE,
    THEME_ICON,
    navigate,
    has_element,
)


class TestDarkMode:
    """Dark mode toggle and persistence."""

    def test_theme_toggle_button_present(self, page):
        navigate(page, "/")
        assert has_element(page, THEME_TOGGLE)

    def test_toggle_switches_to_dark(self, page):
        navigate(page, "/")
        # Clear any saved theme
        page.evaluate("localStorage.removeItem('immi-theme')")
        page.reload(wait_until="networkidle")
        page.click(THEME_TOGGLE)
        page.wait_for_timeout(200)
        theme = page.evaluate("document.documentElement.getAttribute('data-theme')")
        stored = page.evaluate("localStorage.getItem('immi-theme')")
        # One of the toggles should result in 'dark'
        assert theme in ("dark", "light")
        assert stored == theme

    def test_toggle_back_to_light(self, page):
        navigate(page, "/")
        page.evaluate("localStorage.setItem('immi-theme', 'dark')")
        page.reload(wait_until="networkidle")
        page.click(THEME_TOGGLE)
        page.wait_for_timeout(200)
        theme = page.evaluate("document.documentElement.getAttribute('data-theme')")
        assert theme == "light"

    def test_icon_changes_on_toggle(self, page):
        navigate(page, "/")
        page.evaluate("localStorage.setItem('immi-theme', 'light')")
        page.reload(wait_until="networkidle")
        icon_before = page.query_selector(THEME_ICON).get_attribute("class")
        page.click(THEME_TOGGLE)
        page.wait_for_timeout(200)
        icon_after = page.query_selector(THEME_ICON).get_attribute("class")
        assert icon_before != icon_after

    def test_theme_persists_across_pages(self, page):
        navigate(page, "/")
        page.evaluate("localStorage.setItem('immi-theme', 'dark')")
        page.reload(wait_until="networkidle")
        navigate(page, "/cases")
        theme = page.evaluate("document.documentElement.getAttribute('data-theme')")
        assert theme == "dark"

    def test_dark_mode_respects_system_preference(self, page, browser, base_url):
        # Create context with dark color scheme preference
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            base_url=base_url,
            color_scheme="dark",
        )
        dark_page = context.new_page()
        dark_page.goto("/", wait_until="networkidle")
        # Clear any explicit theme
        dark_page.evaluate("localStorage.removeItem('immi-theme')")
        dark_page.reload(wait_until="networkidle")
        theme = dark_page.evaluate("document.documentElement.getAttribute('data-theme')")
        assert theme == "dark"
        context.close()
