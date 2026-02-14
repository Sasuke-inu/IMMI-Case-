"""Dashboard tests — stat cards, charts, chart/table toggle, quick actions."""

import pytest

from .helpers import (
    STAT_CARDS,
    COURT_CHART,
    YEAR_CHART,
    navigate,
    has_element,
    count_elements,
)


class TestStatCards:
    """Dashboard stat cards display correctly."""

    def test_stat_cards_present(self, page):
        navigate(page, "/")
        count = count_elements(page, STAT_CARDS)
        assert count == 4  # Total, Texts, Courts, Natures

    def test_total_cases_card_shows_number(self, page):
        navigate(page, "/")
        card = page.query_selector(f"{STAT_CARDS}.blue")
        assert card
        text = card.inner_text()
        # Stat value should contain a number
        assert any(c.isdigit() for c in text)

    def test_courts_card_shows_number(self, page):
        navigate(page, "/")
        card = page.query_selector(f"{STAT_CARDS}.orange")
        assert card
        text = card.inner_text()
        assert any(c.isdigit() for c in text)

    def test_stat_labels_present(self, page):
        navigate(page, "/")
        labels = page.query_selector_all(".stat-label")
        assert len(labels) == 4
        # Labels are uppercase via CSS, inner_text returns visible text
        label_texts = [l.inner_text().lower() for l in labels]
        assert "total cases" in label_texts
        assert "courts" in label_texts


class TestCharts:
    """Dashboard charts render and toggle works."""

    def test_court_chart_canvas_present(self, page):
        navigate(page, "/")
        assert has_element(page, COURT_CHART)

    def test_year_chart_canvas_present(self, page):
        navigate(page, "/")
        assert has_element(page, YEAR_CHART)

    def test_court_chart_table_toggle(self, page):
        navigate(page, "/")
        table_btn = page.query_selector("[data-chart-toggle='court-table']")
        assert table_btn
        table_btn.click()
        page.wait_for_selector("#court-table-container:not(.d-none)", timeout=2000)
        chart_container = page.query_selector("#court-chart-container")
        assert "d-none" in chart_container.get_attribute("class")

    def test_year_chart_table_toggle(self, page):
        navigate(page, "/")
        table_btn = page.query_selector("[data-chart-toggle='year-table']")
        assert table_btn
        table_btn.click()
        page.wait_for_selector("#year-table-container:not(.d-none)", timeout=2000)


class TestQuickActions:
    """Dashboard quick action buttons work."""

    def test_quick_actions_present(self, page):
        navigate(page, "/")
        links = page.query_selector_all(".d-grid a.btn")
        assert len(links) >= 3

    def test_search_button_links_to_search(self, page):
        navigate(page, "/")
        search_btn = page.query_selector("a.btn-primary[href='/search']")
        assert search_btn
