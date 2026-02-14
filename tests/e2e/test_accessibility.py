"""Accessibility tests — skip link, aria labels, focus order, semantic structure."""

import pytest

from .helpers import (
    SKIP_LINK,
    MAIN_CONTENT,
    SHORTCUTS_MODAL,
    navigate,
    has_element,
)


class TestSkipLink:
    """Skip-to-content link for keyboard users."""

    def test_skip_link_exists(self, page):
        navigate(page, "/")
        assert has_element(page, SKIP_LINK)

    def test_skip_link_targets_main(self, page):
        navigate(page, "/")
        link = page.query_selector(SKIP_LINK)
        href = link.get_attribute("href")
        assert href == "#main-content"

    def test_main_content_has_id(self, page):
        navigate(page, "/")
        main = page.query_selector(MAIN_CONTENT)
        assert main


class TestAriaLabels:
    """Key interactive elements have aria labels."""

    def test_sidebar_has_aria_label(self, page):
        navigate(page, "/")
        nav = page.query_selector("nav[aria-label='Sidebar navigation']")
        assert nav

    def test_pagination_has_aria_label(self, page, is_live_mode):
        if not is_live_mode:
            pytest.skip("No pagination in fixture mode")
        navigate(page, "/cases")
        assert has_element(page, "nav[aria-label='Pagination']")

    def test_theme_toggle_has_aria_label(self, page):
        navigate(page, "/")
        btn = page.query_selector("button[aria-label='Toggle dark mode']")
        assert btn

    def test_shortcuts_modal_has_aria_label(self, page):
        navigate(page, "/")
        modal = page.query_selector(f"{SHORTCUTS_MODAL}")
        assert modal
        assert modal.get_attribute("aria-label")

    def test_mobile_nav_has_aria_label(self, mobile_page):
        navigate(mobile_page, "/")
        nav = mobile_page.query_selector("nav[aria-label='Mobile navigation']")
        assert nav


class TestSemanticStructure:
    """Page uses semantic HTML correctly."""

    def test_main_element_present(self, page):
        navigate(page, "/")
        assert has_element(page, "main")

    def test_nav_elements_present(self, page):
        navigate(page, "/")
        navs = page.query_selector_all("nav")
        assert len(navs) >= 2  # navbar + sidebar nav
