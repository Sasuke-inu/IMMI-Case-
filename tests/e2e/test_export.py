"""Export tests — CSV/JSON download via Playwright download API."""

from .helpers import navigate


class TestCSVExport:
    """CSV export downloads a valid file."""

    def test_csv_export_triggers_download(self, page):
        navigate(page, "/")
        with page.expect_download() as download_info:
            page.evaluate("location.href = '/export/csv'")
        download = download_info.value
        assert download.suggested_filename.endswith(".csv")

    def test_csv_export_filename_has_date(self, page):
        navigate(page, "/")
        with page.expect_download() as download_info:
            page.evaluate("location.href = '/export/csv'")
        download = download_info.value
        assert "immigration_cases_" in download.suggested_filename

    def test_filtered_csv_export(self, page):
        navigate(page, "/")
        with page.expect_download() as download_info:
            page.evaluate("location.href = '/export/csv?court=FCA'")
        download = download_info.value
        assert download.suggested_filename.endswith(".csv")


class TestJSONExport:
    """JSON export downloads a valid file."""

    def test_json_export_triggers_download(self, page):
        navigate(page, "/")
        with page.expect_download() as download_info:
            page.evaluate("location.href = '/export/json'")
        download = download_info.value
        assert download.suggested_filename.endswith(".json")

    def test_json_export_filename_has_date(self, page):
        navigate(page, "/")
        with page.expect_download() as download_info:
            page.evaluate("location.href = '/export/json'")
        download = download_info.value
        assert "immigration_cases_" in download.suggested_filename

    def test_filtered_json_export(self, page):
        navigate(page, "/")
        with page.expect_download() as download_info:
            page.evaluate("location.href = '/export/json?court=FCA'")
        download = download_info.value
        assert download.suggested_filename.endswith(".json")
