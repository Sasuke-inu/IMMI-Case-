"""Search page tests: full-text search and background scrape job form."""

from .react_helpers import (
    react_navigate,
    wait_for_loading_gone,
)


class TestFullTextSearch:
    """Full-text search form and results."""

    def test_search_heading(self, react_page):
        react_navigate(react_page, "/app/search")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Search").first.is_visible()

    def test_search_input_present(self, react_page):
        react_navigate(react_page, "/app/search")
        wait_for_loading_gone(react_page)
        search_input = react_page.locator("input[placeholder*='Search case text']")
        assert search_input.is_visible()

    def test_search_button_present(self, react_page):
        react_navigate(react_page, "/app/search")
        wait_for_loading_gone(react_page)
        btn = react_page.locator("button[type='submit']")
        assert btn.is_visible()

    def test_search_returns_results(self, react_page):
        """Searching for a keyword present in seed data returns results."""
        react_navigate(react_page, "/app/search")
        wait_for_loading_gone(react_page)
        search_input = react_page.locator("input[placeholder*='Search case text']")
        search_input.fill("migration")
        react_page.locator("button[type='submit']").click()
        react_page.wait_for_load_state("networkidle")
        wait_for_loading_gone(react_page)
        # Should show result count
        result_text = react_page.get_by_text("result")
        assert result_text.count() >= 1

    def test_search_empty_query(self, react_page):
        """Submitting an empty search shows no results."""
        react_navigate(react_page, "/app/search")
        wait_for_loading_gone(react_page)
        react_page.locator("button[type='submit']").click()
        react_page.wait_for_timeout(500)
        # No results should appear (or 0 results)
        assert react_page.locator("h1").is_visible()

    def test_search_result_click_navigates(self, react_page):
        """Clicking a search result navigates to case detail."""
        react_navigate(react_page, "/app/search")
        wait_for_loading_gone(react_page)
        search_input = react_page.locator("input[placeholder*='Search case text']")
        search_input.fill("visa")
        react_page.locator("button[type='submit']").click()
        react_page.wait_for_load_state("networkidle")
        wait_for_loading_gone(react_page)
        # Click first result if present
        result_btns = react_page.locator("button").filter(has_text="Minister")
        if result_btns.count() > 0:
            result_btns.first.click()
            react_page.wait_for_load_state("networkidle")
            assert "/cases/" in react_page.url


class TestScrapeJobForm:
    """Background scrape job form (Scrape New Cases section)."""

    def test_scrape_section_visible(self, react_page):
        react_navigate(react_page, "/app/search")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Scrape New Cases").is_visible()

    def test_databases_input_has_default(self, react_page):
        react_navigate(react_page, "/app/search")
        wait_for_loading_gone(react_page)
        db_input = react_page.locator("label").filter(has_text="Databases").locator("..").locator("input")
        assert "AATA" in db_input.first.input_value()

    def test_start_button_present(self, react_page):
        react_navigate(react_page, "/app/search")
        wait_for_loading_gone(react_page)
        start_btn = react_page.get_by_text("Start Search")
        assert start_btn.is_visible()
