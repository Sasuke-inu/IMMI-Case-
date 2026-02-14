"""Navigation tests — sidebar links, mobile nav, global search, offcanvas."""

import pytest

from .helpers import (
    SIDEBAR,
    MOBILE_NAV,
    GLOBAL_SEARCH,
    MOBILE_SEARCH_BAR,
    OFFCANVAS_TOGGLER,
    navigate,
    has_element,
    count_elements,
)


class TestSidebarNavigation:
    """Desktop sidebar links navigate correctly."""

    def test_sidebar_visible_on_desktop(self, page):
        navigate(page, "/")
        assert has_element(page, SIDEBAR)

    def test_sidebar_has_nav_links(self, page):
        navigate(page, "/")
        links = page.query_selector_all(f"{SIDEBAR} .nav-link")
        assert len(links) >= 8  # Dashboard, Browse, Search, Download, Update, Pipeline, Add, Job Status, Data Dict

    def test_dashboard_link_navigates(self, page):
        navigate(page, "/cases")
        page.click(f"{SIDEBAR} a[href='/']")
        page.wait_for_url("**/")

    def test_cases_link_navigates(self, page):
        navigate(page, "/")
        page.click(f"{SIDEBAR} a[href='/cases']")
        page.wait_for_url("**/cases")

    def test_search_link_navigates(self, page):
        navigate(page, "/")
        page.click(f"{SIDEBAR} a[href='/search']")
        page.wait_for_url("**/search")

    def test_active_link_highlighted(self, page):
        navigate(page, "/cases")
        active = page.query_selector(f"{SIDEBAR} a.nav-link.active")
        assert active
        assert "/cases" in active.get_attribute("href")


class TestGlobalSearch:
    """Global search bar functionality."""

    def test_search_bar_visible_on_desktop(self, page):
        navigate(page, "/")
        assert has_element(page, GLOBAL_SEARCH)

    def test_search_submits_to_cases(self, page):
        navigate(page, "/")
        page.fill(GLOBAL_SEARCH, "protection")
        page.press(GLOBAL_SEARCH, "Enter")
        page.wait_for_url("**/cases?q=protection**")

    def test_search_bar_hidden_on_mobile(self, mobile_page):
        navigate(mobile_page, "/")
        # Global search should be hidden (d-none d-md-flex)
        el = mobile_page.query_selector(GLOBAL_SEARCH)
        if el:
            assert not el.is_visible()


class TestMobileNavigation:
    """Mobile bottom nav and offcanvas sidebar."""

    def test_bottom_nav_visible_on_mobile(self, mobile_page):
        navigate(mobile_page, "/")
        assert has_element(mobile_page, MOBILE_NAV)
        links = mobile_page.query_selector_all(f"{MOBILE_NAV} a")
        assert len(links) == 5  # Home, Cases, Search, Download, Update

    def test_bottom_nav_hidden_on_desktop(self, page):
        navigate(page, "/")
        el = page.query_selector(MOBILE_NAV)
        if el:
            assert not el.is_visible()

    def test_offcanvas_toggler_visible_on_mobile(self, mobile_page):
        navigate(mobile_page, "/")
        toggler = mobile_page.query_selector(OFFCANVAS_TOGGLER)
        assert toggler
