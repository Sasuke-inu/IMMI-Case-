"""Case CRUD tests — add/edit/delete, detail page features, related cases."""

import pytest

from .helpers import (
    CASE_ROWS,
    CSRF_TOKEN,
    navigate,
    has_element,
    count_elements,
)


class TestCaseDetail:
    """Case detail page shows full case information."""

    def test_detail_page_loads(self, page, seed_cases, is_live_mode):
        if is_live_mode:
            navigate(page, "/cases")
            first_link = page.query_selector(f"{CASE_ROWS} a")
            assert first_link
            first_link.click()
            page.wait_for_selector(".case-hero", timeout=5000)
        else:
            case_id = seed_cases[0].case_id
            navigate(page, f"/cases/{case_id}")
            page.wait_for_selector(".case-hero", timeout=5000)

    def test_detail_shows_citation(self, page, seed_cases, is_live_mode):
        if is_live_mode:
            pytest.skip("Can't assert exact citation in live mode")
        case = seed_cases[0]
        navigate(page, f"/cases/{case.case_id}")
        text = page.inner_text(".citation-display")
        assert case.citation in text

    def test_detail_shows_court(self, page, seed_cases, is_live_mode):
        if is_live_mode:
            pytest.skip("Can't assert exact court in live mode")
        case = seed_cases[0]
        navigate(page, f"/cases/{case.case_id}")
        text = page.inner_text("body")
        assert case.court_code in text

    def test_detail_has_edit_link(self, page, seed_cases, is_live_mode):
        if is_live_mode:
            navigate(page, "/cases")
            page.click(f"{CASE_ROWS} a")
            page.wait_for_selector(".case-hero", timeout=5000)
        else:
            navigate(page, f"/cases/{seed_cases[0].case_id}")
        edit_link = page.query_selector("a[href*='/edit']")
        assert edit_link

    def test_detail_has_delete_button(self, page, seed_cases, is_live_mode):
        if is_live_mode:
            navigate(page, "/cases")
            page.click(f"{CASE_ROWS} a")
            page.wait_for_selector(".case-hero", timeout=5000)
        else:
            navigate(page, f"/cases/{seed_cases[0].case_id}")
        delete_btn = page.query_selector("button[data-bs-target='#deleteModal']")
        assert delete_btn

    def test_detail_has_breadcrumb(self, page, seed_cases, is_live_mode):
        if is_live_mode:
            pytest.skip("Need known case ID")
        navigate(page, f"/cases/{seed_cases[0].case_id}")
        assert has_element(page, "nav[aria-label='breadcrumb']")

    def test_invalid_case_id_redirects(self, page):
        page.goto("/cases/invalidid12", wait_until="networkidle")
        assert "/cases" in page.url


class TestCaseAdd:
    """Add new case via form."""

    def test_add_page_loads(self, page):
        navigate(page, "/cases/add")
        assert has_element(page, "form")
        assert has_element(page, CSRF_TOKEN)

    def test_add_form_has_fields(self, page):
        navigate(page, "/cases/add")
        assert has_element(page, "input[name='citation']")
        assert has_element(page, "input[name='title']")

    def test_add_case_flow(self, page, skip_if_live):
        navigate(page, "/cases/add")
        page.fill("input[name='citation']", "[2025] TEST 999")
        page.fill("input[name='title']", "E2E Test Case v Minister")
        page.fill("input[name='date']", "2025-01-01")
        page.click("button[type='submit']")
        page.wait_for_url("**/cases/**", timeout=5000)
        body = page.inner_text("body")
        assert "E2E Test Case" in body or "added" in body.lower()


class TestCaseEdit:
    """Edit existing case."""

    def test_edit_page_loads(self, page, seed_cases, is_live_mode):
        if is_live_mode:
            pytest.skip("Need known case ID")
        case = seed_cases[0]
        navigate(page, f"/cases/{case.case_id}/edit")
        assert has_element(page, "form")
        assert has_element(page, CSRF_TOKEN)

    def test_edit_form_prefilled(self, page, seed_cases, is_live_mode):
        if is_live_mode:
            pytest.skip("Need known case ID")
        case = seed_cases[0]
        navigate(page, f"/cases/{case.case_id}/edit")
        title_input = page.query_selector("input[name='title']")
        if title_input:
            val = title_input.input_value()
            assert case.title in val

    def test_edit_saves_changes(self, page, seed_cases, skip_if_live):
        case = seed_cases[0]
        navigate(page, f"/cases/{case.case_id}/edit")
        # user_notes is a textarea, not input
        page.fill("textarea[name='user_notes']", "E2E test note")
        page.click("button[type='submit']")
        page.wait_for_url(f"**/cases/{case.case_id}", timeout=5000)
        body = page.inner_text("body")
        assert "E2E test note" in body or "updated" in body.lower()


class TestCaseDelete:
    """Delete a case via modal confirmation."""

    def test_delete_opens_modal(self, page, seed_cases, is_live_mode):
        if is_live_mode:
            pytest.skip("Need known case ID")
        case = seed_cases[-1]
        navigate(page, f"/cases/{case.case_id}")
        # Click the delete button to open modal
        page.click("button[data-bs-target='#deleteModal']")
        page.wait_for_selector("#deleteModal.show", timeout=2000)
        # Modal should have delete confirmation
        assert has_element(page, "#deleteModal form[action*='/delete']")

    def test_delete_case_flow(self, page, skip_if_live, seed_cases):
        case = seed_cases[-1]
        navigate(page, f"/cases/{case.case_id}")
        # Open delete modal
        page.click("button[data-bs-target='#deleteModal']")
        page.wait_for_selector("#deleteModal.show", timeout=2000)
        # Click submit in modal
        page.click("#deleteModal button[type='submit']")
        page.wait_for_url("**/cases**", timeout=5000)
