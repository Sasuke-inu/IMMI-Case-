"""Keyboard shortcut tests — /, ?, d, b, n, j/k, Esc."""

import pytest

from .helpers import (
    SHORTCUTS_MODAL,
    CASE_ROWS,
    navigate,
)


class TestGlobalShortcuts:
    """Global keyboard shortcuts from base.html."""

    def test_slash_focuses_search(self, page):
        navigate(page, "/")
        page.keyboard.press("/")
        focused = page.evaluate("document.activeElement.id")
        assert focused == "globalSearch"

    def test_question_mark_opens_help(self, page):
        navigate(page, "/")
        page.keyboard.press("?")
        page.wait_for_selector(f"{SHORTCUTS_MODAL}.show", timeout=2000)

    def test_d_navigates_to_dashboard(self, page):
        navigate(page, "/cases")
        page.keyboard.press("d")
        page.wait_for_url("**/", timeout=3000)

    def test_b_navigates_to_browse(self, page):
        navigate(page, "/")
        page.keyboard.press("b")
        page.wait_for_url("**/cases", timeout=3000)

    def test_n_navigates_to_add_case(self, page):
        navigate(page, "/")
        page.keyboard.press("n")
        page.wait_for_url("**/cases/add", timeout=3000)

    def test_modal_can_be_dismissed(self, page):
        navigate(page, "/")
        page.keyboard.press("?")
        page.wait_for_selector(f"{SHORTCUTS_MODAL}.show", timeout=2000)
        # Click the close button — more reliable than Escape key in Playwright
        # (Playwright sends keydown to document, not the modal element Bootstrap listens on)
        page.click(f"{SHORTCUTS_MODAL} .btn-close")
        page.wait_for_function(
            "() => !document.querySelector('#shortcutsModal').classList.contains('show')",
            timeout=3000,
        )

    def test_shortcuts_ignored_in_input(self, page):
        navigate(page, "/cases")
        search_input = page.query_selector("input[name='q']")
        if search_input:
            search_input.focus()
            page.keyboard.type("d")
            # Should NOT navigate away — still on /cases
            assert "/cases" in page.url


class TestCaseListKeyboard:
    """j/k navigation on case list page."""

    def test_j_highlights_next_row(self, page):
        navigate(page, "/cases")
        rows = page.query_selector_all(CASE_ROWS)
        if not rows:
            pytest.skip("No case rows")
        page.keyboard.press("j")
        page.wait_for_timeout(200)
        bg = rows[0].evaluate("el => el.style.background")
        assert bg  # Non-empty means highlighted

    def test_k_highlights_previous_row(self, page):
        navigate(page, "/cases")
        rows = page.query_selector_all(CASE_ROWS)
        if len(rows) < 2:
            pytest.skip("Need at least 2 rows")
        page.keyboard.press("j")
        page.keyboard.press("j")
        page.keyboard.press("k")
        page.wait_for_timeout(200)
        bg = rows[0].evaluate("el => el.style.background")
        assert bg
