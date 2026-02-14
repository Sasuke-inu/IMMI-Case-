"""Job-related page tests: Download, UpdateDB, JobStatus, Pipeline."""

from .react_helpers import (
    react_navigate,
    wait_for_loading_gone,
)


class TestDownloadPage:
    """Download page: full text download form and export buttons."""

    def test_heading(self, react_page):
        react_navigate(react_page, "/app/download")
        wait_for_loading_gone(react_page)
        assert "Download" in react_page.locator("h1").inner_text()

    def test_download_full_text_section(self, react_page):
        react_navigate(react_page, "/app/download")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Download Full Text").is_visible()

    def test_start_download_button(self, react_page):
        react_navigate(react_page, "/app/download")
        wait_for_loading_gone(react_page)
        btn = react_page.get_by_text("Start Download")
        assert btn.is_visible()

    def test_export_data_section(self, react_page):
        react_navigate(react_page, "/app/download")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Export Data").is_visible()

    def test_export_csv_button(self, react_page):
        react_navigate(react_page, "/app/download")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Export CSV").is_visible()

    def test_export_json_button(self, react_page):
        react_navigate(react_page, "/app/download")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Export JSON").is_visible()


class TestUpdateDbPage:
    """Update Database page."""

    def test_heading(self, react_page):
        react_navigate(react_page, "/app/update-db")
        wait_for_loading_gone(react_page)
        assert "Update Database" in react_page.locator("h1").inner_text()

    def test_refresh_section(self, react_page):
        react_navigate(react_page, "/app/update-db")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Refresh Case Data").is_visible()

    def test_databases_input(self, react_page):
        react_navigate(react_page, "/app/update-db")
        wait_for_loading_gone(react_page)
        db_input = react_page.locator("label").filter(has_text="Databases").locator("..").locator("input")
        assert "AATA" in db_input.first.input_value()

    def test_start_update_button(self, react_page):
        react_navigate(react_page, "/app/update-db")
        wait_for_loading_gone(react_page)
        btn = react_page.get_by_text("Start Update")
        assert btn.is_visible()


class TestJobStatusPage:
    """Job Status monitoring page."""

    def test_heading(self, react_page):
        react_navigate(react_page, "/app/jobs")
        wait_for_loading_gone(react_page)
        assert "Job Status" in react_page.locator("h1").inner_text()

    def test_shows_no_active_job(self, react_page):
        """With no running job, should show idle state."""
        react_navigate(react_page, "/app/jobs")
        wait_for_loading_gone(react_page)
        # Should show either "No Active Job" or some status text
        status_text = react_page.locator("p.font-medium").first
        assert status_text.is_visible()


class TestPipelinePage:
    """Smart Pipeline page."""

    def test_heading(self, react_page):
        react_navigate(react_page, "/app/pipeline")
        wait_for_loading_gone(react_page)
        heading = react_page.locator("h1").inner_text()
        assert "Pipeline" in heading

    def test_start_button(self, react_page):
        react_navigate(react_page, "/app/pipeline")
        wait_for_loading_gone(react_page)
        start = react_page.get_by_text("Start", exact=True)
        assert start.is_visible()

    def test_stop_button(self, react_page):
        react_navigate(react_page, "/app/pipeline")
        wait_for_loading_gone(react_page)
        stop = react_page.get_by_text("Stop", exact=True)
        assert stop.is_visible()

    def test_log_viewer(self, react_page):
        react_navigate(react_page, "/app/pipeline")
        wait_for_loading_gone(react_page)
        # Use h2 scope to avoid matching "No logs yet."
        assert react_page.locator("h2").filter(has_text="Logs").is_visible()

    def test_log_toggle(self, react_page):
        react_navigate(react_page, "/app/pipeline")
        wait_for_loading_gone(react_page)
        # Click the logs section header to collapse
        react_page.get_by_text("Collapse").click()
        react_page.wait_for_timeout(300)
        assert react_page.get_by_text("Expand").is_visible()
        # Click again to expand
        react_page.get_by_text("Expand").click()
        react_page.wait_for_timeout(300)
        assert react_page.get_by_text("Collapse").is_visible()

    def test_pipeline_shows_idle_status(self, react_page):
        react_navigate(react_page, "/app/pipeline")
        wait_for_loading_gone(react_page)
        assert react_page.get_by_text("Idle").is_visible()
