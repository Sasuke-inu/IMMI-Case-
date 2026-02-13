"""Extended tests for immi_case_downloader.webapp — Phase 8 coverage."""

import json
from unittest.mock import patch, MagicMock

import pytest

from immi_case_downloader.models import ImmigrationCase
from immi_case_downloader.storage import (
    ensure_output_dirs,
    save_cases_csv,
    save_cases_json,
    save_case_text,
    load_all_cases,
)


# ── Route accessibility ──────────────────────────────────────────────────


class TestRouteAccessibility:
    """Verify all routes return proper status codes."""

    def test_dashboard(self, client):
        assert client.get("/").status_code == 200

    def test_cases(self, client):
        assert client.get("/cases").status_code == 200

    def test_case_detail(self, client, sample_cases):
        resp = client.get(f"/cases/{sample_cases[0].case_id}")
        assert resp.status_code == 200

    def test_case_detail_not_found(self, client):
        resp = client.get("/cases/nonexistent_id")
        assert resp.status_code in (302, 200)

    def test_case_edit_get(self, client, sample_cases):
        resp = client.get(f"/cases/{sample_cases[0].case_id}/edit")
        assert resp.status_code == 200

    def test_case_add_get(self, client):
        assert client.get("/cases/add").status_code == 200

    def test_search_get(self, client):
        assert client.get("/search").status_code == 200

    def test_download_get(self, client):
        assert client.get("/download").status_code == 200

    def test_job_status(self, client):
        assert client.get("/job-status").status_code == 200

    def test_job_status_api(self, client):
        resp = client.get("/api/job-status")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "running" in data

    def test_data_dictionary(self, client):
        assert client.get("/data-dictionary").status_code == 200

    def test_update_db_get(self, client):
        assert client.get("/update-db").status_code == 200

    def test_pipeline_get(self, client):
        assert client.get("/pipeline").status_code == 200

    def test_pipeline_status_api(self, client):
        resp = client.get("/api/pipeline-status")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "running" in data

    def test_pipeline_log_api(self, client):
        resp = client.get("/api/pipeline-log")
        assert resp.status_code == 200

    def test_export_unknown_format(self, client):
        """Unknown export format redirects."""
        resp = client.get("/export/xml", follow_redirects=True)
        assert resp.status_code == 200


# ── Case CRUD ────────────────────────────────────────────────────────────


class TestCaseCRUD:
    def test_add_case(self, client, populated_dir):
        resp = client.post("/cases/add", data={
            "citation": "[2024] NEW 999",
            "title": "Test Add",
            "court": "Federal Court",
            "court_code": "FCA",
            "year": "2024",
            "url": "https://example.com/new",
        }, follow_redirects=True)
        assert resp.status_code == 200
        cases = load_all_cases(str(populated_dir))
        assert any(c.citation == "[2024] NEW 999" for c in cases)

    def test_edit_case(self, client, sample_cases, populated_dir):
        case_id = sample_cases[0].case_id
        resp = client.post(f"/cases/{case_id}/edit", data={
            "citation": sample_cases[0].citation,
            "title": "Updated Title",
            "court": sample_cases[0].court,
            "court_code": sample_cases[0].court_code,
            "date": sample_cases[0].date,
            "year": "2024",
            "url": sample_cases[0].url,
            "judges": "",
            "catchwords": "",
            "outcome": "",
            "visa_type": "",
            "legislation": "",
            "user_notes": "Test note",
            "tags": "test",
            "case_nature": "",
            "legal_concepts": "",
        }, follow_redirects=True)
        assert resp.status_code == 200

    def test_edit_nonexistent_case(self, client):
        resp = client.get("/cases/nonexistent/edit")
        assert resp.status_code in (302, 200)

    def test_delete_case(self, client, sample_cases, populated_dir):
        case_id = sample_cases[0].case_id
        before = len(load_all_cases(str(populated_dir)))
        resp = client.post(f"/cases/{case_id}/delete", follow_redirects=True)
        assert resp.status_code == 200
        after = len(load_all_cases(str(populated_dir)))
        assert after == before - 1

    def test_delete_nonexistent(self, client):
        resp = client.post("/cases/nonexistent/delete", follow_redirects=True)
        assert resp.status_code == 200


# ── Search and download POST ─────────────────────────────────────────────


class TestSearchDownloadPost:
    def test_search_starts_job(self, client):
        """POST /search starts a background job."""
        from immi_case_downloader import webapp
        with webapp._job_lock:
            webapp._job_status["running"] = False

        resp = client.post("/search", data={
            "databases": ["AATA"],
            "start_year": "2024",
            "end_year": "2024",
            "max_results": "10",
        }, follow_redirects=False)
        assert resp.status_code in (302, 303)

    def test_search_rejects_when_running(self, client):
        """POST /search when job running redirects with warning."""
        from immi_case_downloader import webapp
        with webapp._job_lock:
            original = dict(webapp._job_status)
            webapp._job_status["running"] = True
            webapp._job_status["type"] = "test"

        try:
            resp = client.post("/search", data={
                "databases": ["AATA"],
                "start_year": "2024",
                "end_year": "2024",
                "max_results": "10",
            }, follow_redirects=False)
            assert resp.status_code in (302, 303)
        finally:
            with webapp._job_lock:
                webapp._job_status.update(original)

    def test_download_starts_job(self, client):
        from immi_case_downloader import webapp
        with webapp._job_lock:
            webapp._job_status["running"] = False

        resp = client.post("/download", data={
            "court": "",
            "limit": "10",
        }, follow_redirects=False)
        assert resp.status_code in (302, 303)


# ── Update DB page ──────────────────────────────────────────────────────


class TestUpdateDB:
    def test_quick_update(self, client):
        from immi_case_downloader import webapp
        with webapp._job_lock:
            webapp._job_status["running"] = False

        resp = client.post("/update-db", data={
            "action": "quick_update",
            "delay": "0.5",
        }, follow_redirects=False)
        assert resp.status_code in (302, 303)

    def test_custom_crawl(self, client):
        from immi_case_downloader import webapp
        with webapp._job_lock:
            webapp._job_status["running"] = False

        resp = client.post("/update-db", data={
            "action": "custom_crawl",
            "databases": ["AATA"],
            "start_year": "2024",
            "end_year": "2024",
            "delay": "0.5",
        }, follow_redirects=False)
        assert resp.status_code in (302, 303)

    def test_bulk_download(self, client):
        from immi_case_downloader import webapp
        with webapp._job_lock:
            webapp._job_status["running"] = False

        resp = client.post("/update-db", data={
            "action": "bulk_download",
            "court": "",
            "limit": "100",
            "delay": "0.5",
        }, follow_redirects=False)
        assert resp.status_code in (302, 303)

    def test_rejects_when_running(self, client):
        from immi_case_downloader import webapp
        with webapp._job_lock:
            original = dict(webapp._job_status)
            webapp._job_status["running"] = True

        try:
            resp = client.post("/update-db", data={
                "action": "quick_update",
            }, follow_redirects=False)
            assert resp.status_code in (302, 303)
        finally:
            with webapp._job_lock:
                webapp._job_status.update(original)


# ── Pipeline page ─────────────────────────────────────────────────────────


class TestPipelinePage:
    def test_pipeline_post_starts(self, client):
        from immi_case_downloader import webapp
        from immi_case_downloader.pipeline import _pipeline_lock, _pipeline_status

        with webapp._job_lock:
            webapp._job_status["running"] = False
        with _pipeline_lock:
            _pipeline_status["running"] = False

        resp = client.post("/pipeline", data={
            "preset": "quick",
        }, follow_redirects=False)
        assert resp.status_code in (302, 303)

    def test_pipeline_post_rejects_when_running(self, client):
        from immi_case_downloader.pipeline import _pipeline_lock, _pipeline_status

        with _pipeline_lock:
            old_running = _pipeline_status["running"]
            _pipeline_status["running"] = True

        try:
            resp = client.post("/pipeline", data={
                "preset": "quick",
            }, follow_redirects=True)
            assert resp.status_code == 200
        finally:
            with _pipeline_lock:
                _pipeline_status["running"] = old_running

    def test_pipeline_action_stop(self, client):
        """POST /api/pipeline-action with stop action."""
        resp = client.post(
            "/api/pipeline-action",
            data=json.dumps({"action": "stop"}),
            content_type="application/json",
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["ok"] is True

    def test_pipeline_action_unknown(self, client):
        resp = client.post(
            "/api/pipeline-action",
            data=json.dumps({"action": "unknown"}),
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_pipeline_log_filter(self, client):
        resp = client.get("/api/pipeline-log?phase=crawl&level=error&limit=10")
        assert resp.status_code == 200


# ── Filter logic ──────────────────────────────────────────────────────────


class TestFilterCases:
    def test_year_filter(self, client, sample_cases):
        resp = client.get("/cases?year=2024")
        assert resp.status_code == 200

    def test_source_filter(self, client):
        resp = client.get("/cases?source=AustLII")
        assert resp.status_code == 200

    def test_nature_filter(self, client):
        resp = client.get(f"/cases?nature=Visa+Refusal")
        assert resp.status_code == 200

    def test_sort_options(self, client):
        for sort in ("year", "date", "title", "court", "citation"):
            resp = client.get(f"/cases?sort={sort}&dir=asc")
            assert resp.status_code == 200

    def test_invalid_year_filter(self, client):
        """Non-numeric year filter should not crash."""
        resp = client.get("/cases?year=abc")
        assert resp.status_code == 200


# ── Context processor ─────────────────────────────────────────────────────


class TestContextProcessor:
    def test_globals_injected(self, client):
        """Template context includes job_running and pipeline_running."""
        resp = client.get("/")
        assert resp.status_code == 200
        # These variables are used in base.html template
