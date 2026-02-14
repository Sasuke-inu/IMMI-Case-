"""Batch operations tests: select-all, individual select, batch tag/delete, clear."""

from .react_helpers import (
    react_navigate,
    wait_for_loading_gone,
    get_toast_text,
    setup_dialog_handler,
)


class TestBatchSelection:
    """Selecting cases for batch operations."""

    def test_select_all_shows_batch_bar(self, react_page):
        react_navigate(react_page, "/app/cases")
        wait_for_loading_gone(react_page)
        select_all = react_page.locator("thead input[type='checkbox']")
        select_all.click()
        assert react_page.get_by_text("selected").is_visible()
        assert react_page.get_by_text("10 selected").is_visible()

    def test_individual_select_shows_count(self, react_page):
        react_navigate(react_page, "/app/cases")
        wait_for_loading_gone(react_page)
        first_cb = react_page.locator("tbody input[type='checkbox']").first
        first_cb.click()
        assert react_page.get_by_text("1 selected").is_visible()

    def test_select_multiple(self, react_page):
        react_navigate(react_page, "/app/cases")
        wait_for_loading_gone(react_page)
        checkboxes = react_page.locator("tbody input[type='checkbox']")
        checkboxes.nth(0).click()
        checkboxes.nth(1).click()
        checkboxes.nth(2).click()
        assert react_page.get_by_text("3 selected").is_visible()

    def test_deselect_reduces_count(self, react_page):
        react_navigate(react_page, "/app/cases")
        wait_for_loading_gone(react_page)
        checkboxes = react_page.locator("tbody input[type='checkbox']")
        checkboxes.nth(0).click()
        checkboxes.nth(1).click()
        assert react_page.get_by_text("2 selected").is_visible()
        checkboxes.nth(0).click()  # deselect
        assert react_page.get_by_text("1 selected").is_visible()


class TestBatchBar:
    """Batch action bar: Tag, Delete, Clear buttons."""

    def test_batch_bar_has_tag_button(self, react_page):
        react_navigate(react_page, "/app/cases")
        wait_for_loading_gone(react_page)
        react_page.locator("thead input[type='checkbox']").click()
        assert react_page.get_by_text("Tag", exact=True).is_visible()

    def test_batch_bar_has_delete_button(self, react_page):
        react_navigate(react_page, "/app/cases")
        wait_for_loading_gone(react_page)
        react_page.locator("thead input[type='checkbox']").click()
        assert react_page.get_by_text("Delete", exact=True).is_visible()

    def test_clear_selection(self, react_page):
        react_navigate(react_page, "/app/cases")
        wait_for_loading_gone(react_page)
        react_page.locator("thead input[type='checkbox']").click()
        assert react_page.get_by_text("selected").is_visible()
        react_page.get_by_text("Clear").click()
        # Batch bar should disappear
        assert react_page.get_by_text("selected").count() == 0

    def test_batch_tag_with_prompt(self, react_page, skip_if_live):
        """Batch tag triggers a prompt dialog."""
        react_navigate(react_page, "/app/cases")
        wait_for_loading_gone(react_page)
        react_page.locator("tbody input[type='checkbox']").first.click()
        setup_dialog_handler(react_page, accept=True, prompt_text="e2e-batch-tag")
        react_page.get_by_text("Tag", exact=True).click()
        react_page.wait_for_load_state("networkidle")
        toast = get_toast_text(react_page)
        assert "updated" in toast.lower() or "cases updated" in toast.lower()

    def test_batch_tag_cancel(self, react_page):
        """Cancelling the tag prompt does nothing."""
        react_navigate(react_page, "/app/cases")
        wait_for_loading_gone(react_page)
        react_page.locator("tbody input[type='checkbox']").first.click()
        setup_dialog_handler(react_page, accept=False)
        react_page.get_by_text("Tag", exact=True).click()
        react_page.wait_for_timeout(500)
        # Selection should still be active
        assert react_page.get_by_text("1 selected").is_visible()
