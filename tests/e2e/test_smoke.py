"""Smoke tests — legacy routes redirect correctly, React SPA loads, security headers present."""

import pytest

from .helpers import (
    LEGACY_REDIRECT_MAP,
    EXPECTED_SECURITY_HEADERS,
    navigate,
)


class TestLegacyRedirects:
    """All legacy Jinja2 UI routes 301-redirect to the React SPA."""

    @pytest.mark.parametrize("legacy_path,spa_path", LEGACY_REDIRECT_MAP.items())
    def test_legacy_route_redirects(self, page, legacy_path, spa_path):
        """Legacy route follows redirect and lands on React SPA equivalent."""
        resp = page.goto(legacy_path, wait_until="networkidle")
        # Playwright follows redirects; final response must be 200
        assert resp.status == 200, f"{legacy_path} ended with status {resp.status}"
        # Final URL must include the SPA target path
        assert spa_path in page.url, (
            f"{legacy_path} redirected to {page.url}, expected {spa_path}"
        )


class TestReactSpaLoads:
    """React SPA entry point serves the application shell."""

    def test_spa_root_returns_200(self, page):
        resp = page.goto("/app/", wait_until="networkidle")
        assert resp.status == 200

    def test_spa_page_title_present(self, page):
        navigate(page, "/app/")
        title = page.title()
        assert title, "Page title should not be empty"

    def test_spa_has_root_element(self, page):
        navigate(page, "/app/")
        assert page.query_selector("#root") is not None, (
            "React mount point #root must be present"
        )


class TestSecurityHeaders:
    """Security headers are present on both SPA and API responses."""

    @pytest.mark.parametrize("header", EXPECTED_SECURITY_HEADERS)
    def test_spa_security_headers(self, page, header):
        resp = page.goto("/app/", wait_until="networkidle")
        assert resp.headers.get(header.lower()), f"Missing {header} on /app/"

    def test_x_content_type_options_nosniff(self, page):
        resp = page.goto("/app/", wait_until="networkidle")
        assert resp.headers.get("x-content-type-options") == "nosniff"

    def test_x_frame_options_sameorigin(self, page):
        resp = page.goto("/app/", wait_until="networkidle")
        val = resp.headers.get("x-frame-options", "").upper()
        assert val == "SAMEORIGIN"


class TestApiEndpoints:
    """Functional JSON API routes remain operational."""

    def test_job_status_api(self, page):
        resp = page.goto("/api/job-status", wait_until="networkidle")
        assert resp.status == 200

    def test_pipeline_status_api(self, page):
        resp = page.goto("/api/pipeline-status", wait_until="networkidle")
        assert resp.status == 200


class TestExportEndpoints:
    """Export routes trigger file downloads."""

    def test_export_csv_triggers_download(self, page):
        navigate(page, "/app/")
        with page.expect_download() as download_info:
            page.evaluate("location.href = '/export/csv'")
        download = download_info.value
        assert download.suggested_filename.endswith(".csv")

    def test_export_json_triggers_download(self, page):
        navigate(page, "/app/")
        with page.expect_download() as download_info:
            page.evaluate("location.href = '/export/json'")
        download = download_info.value
        assert download.suggested_filename.endswith(".json")
