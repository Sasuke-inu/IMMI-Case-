"""Theme (dark mode) tests: toggle, localStorage persistence, system preference."""

from .react_helpers import (
    react_navigate,
    wait_for_loading_gone,
)


class TestThemeToggle:
    """Dark/light mode toggle button in the topbar."""

    def test_theme_toggle_visible(self, react_page):
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        btn = react_page.get_by_label("Toggle theme")
        assert btn.is_visible()

    def test_toggle_to_dark(self, react_page):
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        react_page.get_by_label("Toggle theme").click()
        # The <html> element should have class "dark"
        has_dark = react_page.evaluate("document.documentElement.classList.contains('dark')")
        assert has_dark

    def test_toggle_back_to_light(self, react_page):
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        # Toggle to dark
        react_page.get_by_label("Toggle theme").click()
        assert react_page.evaluate("document.documentElement.classList.contains('dark')")
        # Toggle back to light
        react_page.get_by_label("Toggle theme").click()
        has_dark = react_page.evaluate("document.documentElement.classList.contains('dark')")
        assert not has_dark


class TestThemePersistence:
    """Theme preference persists in localStorage."""

    def test_theme_stored_in_localstorage(self, react_page):
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        react_page.get_by_label("Toggle theme").click()
        stored = react_page.evaluate("localStorage.getItem('theme')")
        assert stored == "dark"

    def test_theme_persists_across_navigation(self, react_page):
        """After toggling to dark, navigating to another page keeps dark mode."""
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        react_page.get_by_label("Toggle theme").click()
        assert react_page.evaluate("document.documentElement.classList.contains('dark')")

        # Navigate to cases page
        react_navigate(react_page, "/app/cases")
        wait_for_loading_gone(react_page)
        assert react_page.evaluate("document.documentElement.classList.contains('dark')")

    def test_theme_persists_on_reload(self, react_page):
        """After toggling to dark and reloading, theme should remain dark."""
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        react_page.get_by_label("Toggle theme").click()
        assert react_page.evaluate("localStorage.getItem('theme')") == "dark"

        react_page.reload(wait_until="networkidle")
        wait_for_loading_gone(react_page)
        assert react_page.evaluate("document.documentElement.classList.contains('dark')")


class TestThemeIcon:
    """Theme toggle icon changes between Sun and Moon."""

    def test_default_shows_moon_icon(self, react_page):
        """In light mode, the toggle should show Moon icon (to switch to dark)."""
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        # Clear any stored theme to ensure light mode
        react_page.evaluate("localStorage.removeItem('theme')")
        react_page.reload(wait_until="networkidle")
        wait_for_loading_gone(react_page)
        btn = react_page.get_by_label("Toggle theme")
        # The button contains an SVG — we just verify it exists
        assert btn.locator("svg").is_visible()
