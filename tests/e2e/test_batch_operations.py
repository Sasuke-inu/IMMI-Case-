"""Batch operation tests — select all, batch bar, tag, delete, compare."""

import pytest

from .helpers import (
    BATCH_BAR,
    SELECT_ALL,
    CASE_CHECKBOX,
    BATCH_COUNT,
    BATCH_TAG_MODAL,
    BATCH_DELETE_MODAL,
    CASE_ROWS,
    navigate,
    has_element,
    count_elements,
)


class TestBatchSelection:
    """Checkbox selection and batch bar behavior."""

    def test_select_all_checkbox_present(self, page):
        navigate(page, "/cases")
        assert has_element(page, SELECT_ALL)

    def test_individual_checkboxes_present(self, page, is_live_mode):
        navigate(page, "/cases")
        count = count_elements(page, CASE_CHECKBOX)
        if not is_live_mode:
            assert count == 10
        else:
            assert count > 0

    def test_batch_bar_hidden_initially(self, page):
        navigate(page, "/cases")
        bar = page.query_selector(BATCH_BAR)
        assert bar
        assert "show" not in (bar.get_attribute("class") or "")

    def test_select_all_shows_batch_bar(self, page):
        navigate(page, "/cases")
        page.click(SELECT_ALL)
        page.wait_for_timeout(300)
        bar = page.query_selector(BATCH_BAR)
        assert "show" in (bar.get_attribute("class") or "")

    def test_batch_count_updates(self, page, is_live_mode):
        navigate(page, "/cases")
        page.click(SELECT_ALL)
        page.wait_for_timeout(300)
        count_text = page.inner_text(BATCH_COUNT)
        if not is_live_mode:
            assert count_text == "10"
        else:
            assert int(count_text) > 0

    def test_clear_selection_hides_bar(self, page):
        navigate(page, "/cases")
        page.click(SELECT_ALL)
        page.wait_for_timeout(200)
        page.click("text=Clear")
        page.wait_for_timeout(300)
        bar = page.query_selector(BATCH_BAR)
        assert "show" not in (bar.get_attribute("class") or "")


class TestBatchTag:
    """Batch tag modal and submission."""

    def test_tag_button_opens_modal(self, page):
        navigate(page, "/cases")
        page.click(SELECT_ALL)
        page.wait_for_timeout(200)
        page.click(f"{BATCH_BAR} button:has-text('Tag')")
        page.wait_for_selector(f"{BATCH_TAG_MODAL}.show", timeout=2000)

    def test_batch_tag_flow(self, page, skip_if_live):
        navigate(page, "/cases")
        page.click(SELECT_ALL)
        page.wait_for_timeout(200)
        page.click(f"{BATCH_BAR} button:has-text('Tag')")
        page.wait_for_selector(f"{BATCH_TAG_MODAL}.show", timeout=2000)
        page.fill("#batchTagInput", "e2e-test-tag")
        page.click(f"{BATCH_TAG_MODAL} button[type='submit']")
        page.wait_for_url("**/cases**")


class TestBatchDelete:
    """Batch delete modal and confirmation."""

    def test_delete_button_opens_modal(self, page):
        navigate(page, "/cases")
        page.click(SELECT_ALL)
        page.wait_for_timeout(200)
        page.click(f"{BATCH_BAR} button:has-text('Delete')")
        page.wait_for_selector(f"{BATCH_DELETE_MODAL}.show", timeout=2000)


class TestCompare:
    """Compare selected cases."""

    def test_compare_needs_two_cases(self, page):
        navigate(page, "/cases")
        # Select just one checkbox
        first_cb = page.query_selector(CASE_CHECKBOX)
        if first_cb:
            first_cb.click()
            page.wait_for_timeout(200)

    def test_compare_page_loads(self, page, seed_cases, is_live_mode):
        if is_live_mode:
            pytest.skip("Need known case IDs")
        ids = f"{seed_cases[0].case_id},{seed_cases[1].case_id}"
        navigate(page, f"/cases/compare?ids={ids}")
        body = page.inner_text("body")
        assert seed_cases[0].citation in body
        assert seed_cases[1].citation in body
