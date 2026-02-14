"""Form validation tests — required fields, CSRF tokens present on all forms."""

import pytest

from .helpers import (
    CSRF_TOKEN,
    navigate,
    has_element,
    count_elements,
)


class TestCSRFTokens:
    """All POST forms include CSRF tokens."""

    def test_add_case_form_has_csrf(self, page):
        navigate(page, "/cases/add")
        assert has_element(page, CSRF_TOKEN)

    def test_edit_case_form_has_csrf(self, page, seed_cases, is_live_mode):
        if is_live_mode:
            pytest.skip("Need known case ID")
        navigate(page, f"/cases/{seed_cases[0].case_id}/edit")
        assert has_element(page, CSRF_TOKEN)

    def test_delete_form_has_csrf(self, page, seed_cases, is_live_mode):
        if is_live_mode:
            pytest.skip("Need known case ID")
        navigate(page, f"/cases/{seed_cases[0].case_id}")
        delete_form = page.query_selector("form[action*='/delete']")
        if delete_form:
            csrf = delete_form.query_selector(CSRF_TOKEN)
            assert csrf

    def test_search_form_has_csrf(self, page):
        navigate(page, "/search")
        forms = page.query_selector_all("form[method='post']")
        for form in forms:
            csrf = form.query_selector(CSRF_TOKEN)
            assert csrf, "POST form missing CSRF token"

    def test_batch_tag_form_has_csrf(self, page):
        navigate(page, "/cases")
        form = page.query_selector("#batchTagForm")
        if form:
            assert form.query_selector(CSRF_TOKEN)

    def test_batch_delete_form_has_csrf(self, page):
        navigate(page, "/cases")
        form = page.query_selector("#batchDeleteForm")
        if form:
            assert form.query_selector(CSRF_TOKEN)


class TestFormFields:
    """Forms have expected input fields."""

    def test_add_form_has_title_field(self, page):
        navigate(page, "/cases/add")
        assert has_element(page, "input[name='title']")

    def test_add_form_has_citation_field(self, page):
        navigate(page, "/cases/add")
        assert has_element(page, "input[name='citation']")

    def test_search_form_has_database_options(self, page):
        navigate(page, "/search")
        # Should have checkboxes or select for databases
        has_db = has_element(page, "input[name='databases']") or has_element(page, "select[name='databases']")
        assert has_db

    def test_download_form_has_limit(self, page):
        navigate(page, "/download")
        has_limit = has_element(page, "input[name='limit']") or has_element(page, "select[name='limit']")
        assert has_limit
