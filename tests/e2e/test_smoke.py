"""Smoke tests — every page loads, no JS errors, security headers present."""

import pytest

from .helpers import (
    SMOKE_ROUTES,
    EXPECTED_SECURITY_HEADERS,
    MAIN_CONTENT,
    NAVBAR,
    navigate,
    get_js_errors,
    has_element,
)


class TestPageLoads:
    """Every navigable route returns 200 and renders basic layout."""

    @pytest.mark.parametrize("path", SMOKE_ROUTES)
    def test_page_returns_200(self, page, path):
        resp = page.goto(path, wait_until="networkidle")
        assert resp.status == 200, f"{path} returned {resp.status}"

    @pytest.mark.parametrize("path", SMOKE_ROUTES)
    def test_page_has_navbar(self, page, path):
        navigate(page, path)
        assert has_element(page, NAVBAR)

    @pytest.mark.parametrize("path", SMOKE_ROUTES)
    def test_page_has_main_content(self, page, path):
        navigate(page, path)
        assert has_element(page, MAIN_CONTENT)

    @pytest.mark.parametrize("path", SMOKE_ROUTES)
    def test_no_js_errors(self, page, path):
        navigate(page, path)
        errors = get_js_errors(page)
        assert not errors, f"JS errors on {path}: {errors}"

    def test_page_title_contains_immi(self, page):
        navigate(page, "/")
        assert "IMMI-Case" in page.title() or "Immigration" in page.title()


class TestSecurityHeaders:
    """Security headers present on every response."""

    @pytest.mark.parametrize("path", SMOKE_ROUTES)
    def test_security_headers_present(self, page, path):
        resp = page.goto(path, wait_until="networkidle")
        for header in EXPECTED_SECURITY_HEADERS:
            assert resp.headers.get(header.lower()), f"Missing {header} on {path}"

    def test_x_content_type_options_nosniff(self, page):
        resp = page.goto("/", wait_until="networkidle")
        assert resp.headers.get("x-content-type-options") == "nosniff"

    def test_x_frame_options_sameorigin(self, page):
        resp = page.goto("/", wait_until="networkidle")
        val = resp.headers.get("x-frame-options", "").upper()
        assert val == "SAMEORIGIN"


class TestExportEndpoints:
    """Export routes trigger downloads."""

    def test_export_csv_triggers_download(self, page):
        navigate(page, "/")
        with page.expect_download() as download_info:
            page.evaluate("location.href = '/export/csv'")
        download = download_info.value
        assert download.suggested_filename.endswith(".csv")

    def test_export_json_triggers_download(self, page):
        navigate(page, "/")
        with page.expect_download() as download_info:
            page.evaluate("location.href = '/export/json'")
        download = download_info.value
        assert download.suggested_filename.endswith(".json")


class TestApiEndpoints:
    """API routes return valid JSON."""

    def test_job_status_api(self, page):
        resp = page.goto("/api/job-status", wait_until="networkidle")
        assert resp.status == 200

    def test_pipeline_status_api(self, page):
        resp = page.goto("/api/pipeline-status", wait_until="networkidle")
        assert resp.status == 200
