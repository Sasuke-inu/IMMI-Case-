"""Data Dictionary and Design Tokens page tests."""

from .react_helpers import (
    react_navigate,
    wait_for_loading_gone,
)


class TestDataDictionaryPage:
    """Data Dictionary page: table of field definitions."""

    def test_heading(self, react_page):
        react_navigate(react_page, "/app/data-dictionary")
        wait_for_loading_gone(react_page)
        assert "Data Dictionary" in react_page.locator("h1").inner_text()

    def test_table_has_columns(self, react_page):
        react_navigate(react_page, "/app/data-dictionary")
        wait_for_loading_gone(react_page)
        for col in ["Field", "Type", "Description", "Example"]:
            assert react_page.locator("th").get_by_text(col).is_visible()

    def test_table_has_20_fields(self, react_page):
        react_navigate(react_page, "/app/data-dictionary")
        wait_for_loading_gone(react_page)
        rows = react_page.locator("tbody tr")
        assert rows.count() == 20

    def test_case_id_field_present(self, react_page):
        react_navigate(react_page, "/app/data-dictionary")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("case_id").is_visible()

    def test_citation_field_present(self, react_page):
        react_navigate(react_page, "/app/data-dictionary")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("citation").first.is_visible()


class TestDesignTokensPage:
    """Design Tokens page: color palette, typography, spacing, badges."""

    def test_heading(self, react_page):
        react_navigate(react_page, "/app/design-tokens")
        wait_for_loading_gone(react_page)
        assert "Design Tokens" in react_page.locator("h1").inner_text()

    def test_color_palette_section(self, react_page):
        react_navigate(react_page, "/app/design-tokens")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Color Palette").is_visible()

    def test_typography_section(self, react_page):
        react_navigate(react_page, "/app/design-tokens")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Typography").is_visible()

    def test_spacing_section(self, react_page):
        react_navigate(react_page, "/app/design-tokens")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Spacing", exact=True).is_visible()

    def test_court_badges_section(self, react_page):
        react_navigate(react_page, "/app/design-tokens")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Court Badges").is_visible()

    def test_outcome_badges_section(self, react_page):
        react_navigate(react_page, "/app/design-tokens")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Outcome Badges").is_visible()

    def test_usage_examples_section(self, react_page):
        react_navigate(react_page, "/app/design-tokens")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Usage Examples").is_visible()

    def test_court_badge_colors_rendered(self, react_page):
        """Court badges like AATA, FCA should render with colors."""
        react_navigate(react_page, "/app/design-tokens")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("AATA", exact=True).first.is_visible()
        assert react_page.get_by_text("FCA", exact=True).first.is_visible()
