"""Case CRUD lifecycle tests: create, read, edit, delete."""

from .react_helpers import (
    react_navigate,
    wait_for_loading_gone,
    get_toast_text,
    setup_dialog_handler,
)


def _navigate_to_first_case(page):
    """Navigate to the first case detail page, waiting for the API response."""
    react_navigate(page, "/app/cases")
    wait_for_loading_gone(page)
    first_row = page.locator("tbody tr").first
    with page.expect_response(
        lambda r: "/api/v1/cases/" in r.url and r.request.method == "GET",
        timeout=15000,
    ):
        first_row.click()
    page.wait_for_timeout(500)
    wait_for_loading_gone(page)


def _navigate_to_last_case(page):
    """Navigate to the last case detail page, waiting for the API response."""
    react_navigate(page, "/app/cases")
    wait_for_loading_gone(page)
    last_row = page.locator("tbody tr").last
    with page.expect_response(
        lambda r: "/api/v1/cases/" in r.url and r.request.method == "GET",
        timeout=15000,
    ):
        last_row.click()
    page.wait_for_timeout(500)
    wait_for_loading_gone(page)


def _navigate_to_edit(page):
    """Navigate to the edit page from the case detail page."""
    _navigate_to_first_case(page)
    main = page.locator("main")
    with page.expect_response(
        lambda r: "/api/v1/cases/" in r.url and r.request.method == "GET",
        timeout=15000,
    ):
        main.get_by_text("Edit", exact=True).click()
    page.wait_for_timeout(500)
    wait_for_loading_gone(page)


class TestCreateCase:
    """Create a new case via the Add Case form."""

    def test_add_page_has_form(self, react_page, skip_if_live):
        react_navigate(react_page, "/app/cases/add")
        wait_for_loading_gone(react_page)
        assert react_page.locator("main").get_by_text("Add Case").first.is_visible()
        assert react_page.locator("label").get_by_text("Title").is_visible()

    def test_create_case_success(self, react_page, skip_if_live):
        """Fill form and create a case, verify toast and redirect."""
        react_navigate(react_page, "/app/cases/add")
        wait_for_loading_gone(react_page)

        title_input = react_page.locator("input").first
        title_input.fill("Test Case E2E Created")

        inputs = react_page.locator("input[type='text']")
        if inputs.count() >= 2:
            inputs.nth(1).fill("[2024] TEST 999")
        if inputs.count() >= 4:
            inputs.nth(3).fill("TEST")

        react_page.locator("main").get_by_text("Create").click()
        react_page.wait_for_load_state("networkidle")

        toast = get_toast_text(react_page)
        assert "created" in toast.lower() or "Case created" in toast
        assert "/cases/" in react_page.url

    def test_create_without_title_shows_error(self, react_page, skip_if_live):
        """Submitting without title shows error toast."""
        react_navigate(react_page, "/app/cases/add")
        wait_for_loading_gone(react_page)
        react_page.locator("main").get_by_text("Create").click()
        toast = get_toast_text(react_page)
        assert "required" in toast.lower() or "Title" in toast

    def test_cancel_returns_to_previous(self, react_page, skip_if_live):
        react_navigate(react_page, "/app/cases")
        wait_for_loading_gone(react_page)
        react_navigate(react_page, "/app/cases/add")
        wait_for_loading_gone(react_page)
        react_page.get_by_text("Cancel").click()
        react_page.wait_for_load_state("networkidle")
        assert "/cases" in react_page.url


class TestEditCase:
    """Edit an existing case."""

    def test_edit_page_loads(self, react_page, skip_if_live):
        """Navigate to edit from case detail."""
        _navigate_to_edit(react_page)
        assert "Edit Case" in react_page.locator("h1").inner_text()

    def test_edit_form_prefilled(self, react_page, skip_if_live):
        """Edit form should be pre-filled with existing case data."""
        _navigate_to_edit(react_page)
        title_input = react_page.locator("input[type='text']").first
        assert title_input.input_value() != ""

    def test_edit_save_success(self, react_page, skip_if_live):
        """Saving an edit shows success toast."""
        _navigate_to_edit(react_page)

        tag_labels = react_page.locator("label").filter(has_text="Tags")
        if tag_labels.count() > 0:
            tag_input = tag_labels.first.locator("..").locator("input")
            if tag_input.count() > 0:
                tag_input.first.fill("e2e-test-tag")

        react_page.get_by_text("Save").click()
        react_page.wait_for_load_state("networkidle")
        toast = get_toast_text(react_page)
        assert "updated" in toast.lower() or "Case updated" in toast

    def test_edit_cancel(self, react_page, skip_if_live):
        _navigate_to_edit(react_page)
        react_page.get_by_text("Cancel").click()
        react_page.wait_for_load_state("networkidle")
        assert "/edit" not in react_page.url


class TestDeleteCase:
    """Delete a case with confirmation dialog."""

    def test_delete_confirm_dialog(self, react_page, skip_if_live):
        """Delete button triggers a confirm dialog."""
        _navigate_to_last_case(react_page)
        main = react_page.locator("main")

        setup_dialog_handler(react_page, accept=True)
        main.get_by_text("Delete", exact=True).click()
        react_page.wait_for_load_state("networkidle")

        toast = get_toast_text(react_page)
        assert "deleted" in toast.lower() or "Case deleted" in toast
        assert "/cases" in react_page.url

    def test_delete_dismiss_dialog(self, react_page, skip_if_live):
        """Dismissing the confirm dialog does NOT delete the case."""
        _navigate_to_first_case(react_page)
        main = react_page.locator("main")

        setup_dialog_handler(react_page, accept=False)
        main.get_by_text("Delete", exact=True).click()
        react_page.wait_for_timeout(500)
        assert "/cases/" in react_page.url
