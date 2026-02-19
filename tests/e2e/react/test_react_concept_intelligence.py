"""E2E tests for concept intelligence section on Analytics page."""

from .react_helpers import react_navigate, wait_for_loading_gone, assert_no_js_errors


class TestConceptIntelligence:
    def test_effectiveness_chart_visible(self, react_page):
        react_navigate(react_page, "/app/analytics")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Concept Effectiveness").first.is_visible()

    def test_cooccurrence_heatmap_visible(self, react_page):
        react_navigate(react_page, "/app/analytics")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Legal Concept Co-occurrence").is_visible()

    def test_trend_chart_visible(self, react_page):
        react_navigate(react_page, "/app/analytics")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Concept Trends").is_visible()

    def test_emerging_badges_visible(self, react_page):
        react_navigate(react_page, "/app/analytics")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Emerging Concepts").is_visible()

    def test_no_js_errors(self, react_page):
        react_navigate(react_page, "/app/analytics")
        wait_for_loading_gone(react_page)
        assert_no_js_errors(react_page)
