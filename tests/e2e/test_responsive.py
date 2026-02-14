"""Responsive layout tests — mobile cards vs table, bottom nav, offcanvas."""

import pytest

from .helpers import (
    CASE_TABLE,
    CASE_CARDS_MOBILE,
    MOBILE_NAV,
    SIDEBAR,
    OFFCANVAS_TOGGLER,
    MOBILE_SIDEBAR,
    navigate,
    has_element,
    count_elements,
)


class TestDesktopLayout:
    """Desktop viewport (1280x800) shows table layout."""

    def test_sidebar_visible(self, page):
        navigate(page, "/")
        sidebar = page.query_selector(SIDEBAR)
        assert sidebar
        assert sidebar.is_visible()

    def test_case_table_visible(self, page):
        navigate(page, "/cases")
        table = page.query_selector(CASE_TABLE)
        assert table
        assert table.is_visible()

    def test_mobile_nav_hidden(self, page):
        navigate(page, "/")
        nav = page.query_selector(MOBILE_NAV)
        if nav:
            assert not nav.is_visible()

    def test_mobile_cards_hidden(self, page):
        navigate(page, "/cases")
        # Mobile cards should be hidden on desktop (d-md-none parent)
        cards = page.query_selector_all(CASE_CARDS_MOBILE)
        for card in cards:
            assert not card.is_visible()


class TestMobileLayout:
    """Mobile viewport (390x844) shows card layout."""

    def test_sidebar_hidden(self, mobile_page):
        navigate(mobile_page, "/")
        sidebar = mobile_page.query_selector(SIDEBAR)
        if sidebar:
            assert not sidebar.is_visible()

    def test_case_cards_visible(self, mobile_page):
        navigate(mobile_page, "/cases")
        cards = mobile_page.query_selector_all(CASE_CARDS_MOBILE)
        assert len(cards) > 0
        assert cards[0].is_visible()

    def test_case_table_hidden(self, mobile_page):
        navigate(mobile_page, "/cases")
        table = mobile_page.query_selector(CASE_TABLE)
        if table:
            assert not table.is_visible()

    def test_bottom_nav_visible(self, mobile_page):
        navigate(mobile_page, "/")
        nav = mobile_page.query_selector(MOBILE_NAV)
        assert nav
        assert nav.is_visible()

    def test_bottom_nav_has_5_items(self, mobile_page):
        navigate(mobile_page, "/")
        links = mobile_page.query_selector_all(f"{MOBILE_NAV} a")
        assert len(links) == 5

    def test_offcanvas_opens_on_hamburger(self, mobile_page):
        navigate(mobile_page, "/")
        toggler = mobile_page.query_selector(OFFCANVAS_TOGGLER)
        if toggler and toggler.is_visible():
            toggler.click()
            mobile_page.wait_for_selector(f"{MOBILE_SIDEBAR}.show", timeout=2000)


class TestTabletLayout:
    """Tablet viewport (768x1024) — intermediate behavior."""

    def test_tablet_shows_sidebar(self, browser, base_url):
        context = browser.new_context(
            viewport={"width": 768, "height": 1024},
            base_url=base_url,
        )
        tablet_page = context.new_page()
        tablet_page.goto("/", wait_until="networkidle")
        sidebar = tablet_page.query_selector(SIDEBAR)
        assert sidebar
        # At md breakpoint (768px) sidebar should be visible
        assert sidebar.is_visible()
        context.close()

    def test_tablet_hides_bottom_nav(self, browser, base_url):
        context = browser.new_context(
            viewport={"width": 768, "height": 1024},
            base_url=base_url,
        )
        tablet_page = context.new_page()
        tablet_page.goto("/", wait_until="networkidle")
        nav = tablet_page.query_selector(MOBILE_NAV)
        if nav:
            assert not nav.is_visible()
        context.close()
