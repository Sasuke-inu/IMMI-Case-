"""Smoke tests — React SPA loads at /, security headers present, API routes functional."""

import pytest

from .helpers import (
    SPA_ROUTES,
    EXPECTED_SECURITY_HEADERS,
    navigate,
)


class TestReactSpaLoads:
    """React SPA serves the application shell at all routes."""

    def test_spa_root_returns_200(self, page):
        resp = page.goto("/", wait_until="networkidle")
        assert resp.status == 200

    def test_spa_page_title_present(self, page):
        navigate(page, "/")
        title = page.title()
        assert title, "Page title should not be empty"

    def test_spa_has_root_element(self, page):
        navigate(page, "/")
        assert page.query_selector("#root") is not None, (
            "React mount point #root must be present"
        )

    @pytest.mark.parametrize("path", SPA_ROUTES)
    def test_spa_routes_return_200(self, page, path):
        """All known SPA routes serve index.html (200)."""
        resp = page.goto(path, wait_until="networkidle")
        assert resp.status == 200, f"{path} returned {resp.status}"


class TestSecurityHeaders:
    """Security headers are present on both SPA and API responses."""

    @pytest.mark.parametrize("header", EXPECTED_SECURITY_HEADERS)
    def test_spa_security_headers(self, page, header):
        resp = page.goto("/", wait_until="networkidle")
        assert resp.headers.get(header.lower()), f"Missing {header} on /"

    def test_x_content_type_options_nosniff(self, page):
        resp = page.goto("/", wait_until="networkidle")
        assert resp.headers.get("x-content-type-options") == "nosniff"

    def test_x_frame_options_sameorigin(self, page):
        resp = page.goto("/", wait_until="networkidle")
        val = resp.headers.get("x-frame-options", "").upper()
        assert val == "SAMEORIGIN"


class TestApiEndpoints:
    """Functional JSON API routes remain operational."""

    def test_job_status_api(self, page):
        resp = page.goto("/api/v1/job-status", wait_until="networkidle")
        assert resp.status == 200

    def test_pipeline_status_api(self, page):
        resp = page.goto("/api/v1/pipeline-status", wait_until="networkidle")
        assert resp.status == 200


class TestExportEndpoints:
    """Export routes trigger file downloads via API v1."""

    def test_export_csv_triggers_download(self, page):
        navigate(page, "/")
        with page.expect_download() as download_info:
            page.evaluate("location.href = '/api/v1/export/csv'")
        download = download_info.value
        assert download.suggested_filename.endswith(".csv")

    def test_export_json_triggers_download(self, page):
        navigate(page, "/")
        with page.expect_download() as download_info:
            page.evaluate("location.href = '/api/v1/export/json'")
        download = download_info.value
        assert download.suggested_filename.endswith(".json")
