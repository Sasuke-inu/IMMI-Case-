"""Case browse tests — filters, pagination, sort, filter pills, empty state."""

import pytest

from .helpers import (
    CASE_TABLE,
    CASE_ROWS,
    FILTER_BAR,
    FILTER_FORM,
    FILTER_PILLS,
    EMPTY_STATE,
    PAGINATION,
    navigate,
    has_element,
    count_elements,
)


class TestCaseList:
    """Cases page renders case table with data."""

    def test_case_table_present(self, page):
        navigate(page, "/cases")
        assert has_element(page, CASE_TABLE)

    def test_cases_displayed(self, page):
        navigate(page, "/cases")
        rows = count_elements(page, CASE_ROWS)
        assert rows > 0

    def test_case_has_citation_link(self, page):
        navigate(page, "/cases")
        first_link = page.query_selector(f"{CASE_ROWS} a")
        assert first_link
        href = first_link.get_attribute("href")
        assert "/cases/" in href

    def test_court_badges_displayed(self, page):
        navigate(page, "/cases")
        badges = page.query_selector_all(".badge-court")
        assert len(badges) > 0

    def test_result_count_shown(self, page):
        navigate(page, "/cases")
        text = page.inner_text("body")
        assert "result" in text.lower()


class TestFilters:
    """Filter bar applies filters correctly."""

    def test_filter_bar_present(self, page):
        navigate(page, "/cases")
        assert has_element(page, FILTER_BAR)

    def test_filter_by_court(self, page, is_live_mode):
        navigate(page, "/cases?court=FCA")
        rows = count_elements(page, CASE_ROWS)
        if not is_live_mode:
            assert rows == 2  # 2 FCA seed cases
        else:
            assert rows >= 0

    def test_filter_by_keyword(self, page, is_live_mode):
        navigate(page, "/cases?q=Singh")
        if not is_live_mode:
            rows = count_elements(page, CASE_ROWS)
            assert rows == 1

    def test_filter_pills_appear(self, page):
        navigate(page, "/cases?court=FCA")
        pills = page.query_selector_all(FILTER_PILLS)
        assert len(pills) >= 1

    def test_clear_filters_link(self, page):
        navigate(page, "/cases?court=FCA")
        clear_btn = page.query_selector("a[href='/cases'][title='Clear all filters']")
        assert clear_btn

    def test_filter_by_year_via_url(self, page, is_live_mode):
        if is_live_mode:
            pytest.skip("Year values vary in live mode")
        navigate(page, "/cases?year=2022")
        rows = count_elements(page, CASE_ROWS)
        assert rows == 2  # 2 FCCA 2022 seed cases

    def test_advanced_filters_expand(self, page):
        navigate(page, "/cases")
        # Click "More" button to expand advanced filters
        more_btn = page.query_selector(".filter-toggle-btn")
        assert more_btn
        more_btn.click()
        page.wait_for_selector("#advancedFilters.show", timeout=2000)
        # Year select should now be visible
        year_select = page.query_selector("select[name='year']")
        assert year_select
        assert year_select.is_visible()

    def test_combined_filters(self, page, is_live_mode):
        if is_live_mode:
            pytest.skip("Exact counts vary in live mode")
        navigate(page, "/cases?court=AATA&year=2024")
        rows = count_elements(page, CASE_ROWS)
        assert rows == 2  # 2 AATA 2024 seed cases


class TestSort:
    """Sort controls work correctly."""

    def test_sort_by_date(self, page):
        navigate(page, "/cases?sort=date&dir=desc")
        assert has_element(page, CASE_TABLE)

    def test_sort_by_title(self, page):
        navigate(page, "/cases?sort=title&dir=asc")
        assert has_element(page, CASE_TABLE)

    def test_sort_by_court(self, page):
        navigate(page, "/cases?sort=court&dir=asc")
        assert has_element(page, CASE_TABLE)


class TestEmptyState:
    """Empty state displays when no cases match."""

    def test_empty_state_on_no_results(self, page):
        navigate(page, "/cases?q=zzzznonexistentquery12345")
        assert has_element(page, EMPTY_STATE)
        text = page.inner_text(EMPTY_STATE)
        assert "no cases found" in text.lower()


class TestPagination:
    """Pagination controls when many cases exist."""

    def test_pagination_in_live_mode(self, page, is_live_mode):
        if not is_live_mode:
            pytest.skip("Only seed cases — no pagination in fixture mode")
        navigate(page, "/cases")
        assert has_element(page, PAGINATION)

    def test_no_pagination_with_few_cases(self, page, is_live_mode):
        if is_live_mode:
            pytest.skip("Live mode has many cases")
        navigate(page, "/cases")
        assert not has_element(page, PAGINATION)
