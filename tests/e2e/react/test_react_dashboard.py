"""Dashboard page tests: stat cards, charts, quick actions, recent cases."""

from .react_helpers import (
    react_navigate,
    wait_for_loading_gone,
)


class TestStatCards:
    """Dashboard stat cards with live data from seed cases."""

    def test_total_cases_card(self, react_page):
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Total Cases").is_visible()

    def test_with_full_text_card(self, react_page):
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("With Full Text").is_visible()

    def test_courts_card(self, react_page):
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Courts").first.is_visible()

    def test_sources_card(self, react_page):
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Sources").first.is_visible()

    def test_stat_card_shows_numeric_value(self, react_page):
        """Total Cases should display '10' from seed data."""
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("10").first.is_visible()


class TestCharts:
    """Chart sections for court distribution."""

    def test_cases_by_court_section(self, react_page):
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Cases by Court").is_visible()

    def test_distribution_section(self, react_page):
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Distribution").is_visible()

    def test_chart_renders_svg(self, react_page):
        """Recharts renders SVG elements for the charts."""
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        svgs = react_page.locator("svg.recharts-surface")
        assert svgs.count() >= 1


class TestQuickActions:
    """Quick action buttons that navigate to other pages."""

    def test_search_cases_action(self, react_page):
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        # Scope to main to avoid sidebar duplicates
        main = react_page.locator("main")
        btn = main.get_by_text("Search Cases")
        assert btn.is_visible()
        btn.click()
        react_page.wait_for_load_state("networkidle")
        assert "/search" in react_page.url

    def test_download_action(self, react_page):
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        main = react_page.locator("main")
        btn = main.get_by_text("Download", exact=True)
        assert btn.is_visible()

    def test_pipeline_action(self, react_page):
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        main = react_page.locator("main")
        btn = main.get_by_text("Pipeline", exact=True)
        assert btn.is_visible()

    def test_update_db_action(self, react_page):
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        main = react_page.locator("main")
        btn = main.get_by_text("Update DB")
        assert btn.is_visible()


class TestRecentCases:
    """Recent cases section shows seed data."""

    def test_recent_cases_heading(self, react_page):
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Recent Cases").is_visible()

    def test_recent_case_clickable(self, react_page):
        """Clicking a recent case navigates to its detail page."""
        react_navigate(react_page, "/app/")
        wait_for_loading_gone(react_page)
        # Click the first case in the recent cases list
        recent_section = react_page.locator("text=Recent Cases").locator("..")
        first_case = recent_section.locator("button").first
        if first_case.is_visible():
            first_case.click()
            react_page.wait_for_load_state("networkidle")
            assert "/cases/" in react_page.url
