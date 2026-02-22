"""Tests for immi_case_downloader.web — redirect-only UI routes and functional endpoints."""

import json

import pytest


# ── UI route redirects ────────────────────────────────────────────────────

REDIRECT_ROUTES = [
    ("/", "/app/"),
    ("/cases", "/app/cases"),
    ("/cases/add", "/app/cases/add"),
    ("/cases/compare", "/app/cases/compare"),
    ("/search", "/app/download"),
    ("/download", "/app/download"),
    ("/update-db", "/app/pipeline"),
    ("/pipeline", "/app/pipeline"),
    ("/job-status", "/app/jobs"),
    ("/data-dictionary", "/app/data-dictionary"),
]


class TestLegacyRedirects:
    """All legacy UI routes return 301 redirects to the React SPA."""

    @pytest.mark.parametrize("path,target", REDIRECT_ROUTES)
    def test_get_returns_redirect(self, client, path, target):
        resp = client.get(path)
        assert resp.status_code == 301, f"{path} should return 301, got {resp.status_code}"
        assert target in resp.headers["Location"], (
            f"{path} should redirect to {target}, got {resp.headers.get('Location')}"
        )

    def test_case_detail_redirects(self, client, sample_cases):
        case_id = sample_cases[0].case_id
        resp = client.get(f"/cases/{case_id}")
        assert resp.status_code == 301
        assert f"/app/cases/{case_id}" in resp.headers["Location"]

    def test_case_edit_get_redirects(self, client, sample_cases):
        case_id = sample_cases[0].case_id
        resp = client.get(f"/cases/{case_id}/edit")
        assert resp.status_code == 301
        assert f"/app/cases/{case_id}/edit" in resp.headers["Location"]

    def test_case_edit_post_redirects(self, client, sample_cases):
        case_id = sample_cases[0].case_id
        resp = client.post(f"/cases/{case_id}/edit", data={"title": "x"})
        assert resp.status_code == 301

    def test_case_delete_post_redirects(self, client, sample_cases):
        case_id = sample_cases[0].case_id
        resp = client.post(f"/cases/{case_id}/delete")
        assert resp.status_code == 302
        assert "/app/cases" in resp.headers["Location"]

    def test_case_batch_post_redirects(self, client):
        resp = client.post("/cases/batch", data={"action": "delete", "ids": ""})
        assert resp.status_code == 302
        assert "/app/cases" in resp.headers["Location"]

    def test_search_post_redirects(self, client):
        resp = client.post("/search", data={"databases": "AATA"})
        assert resp.status_code == 301

    def test_download_post_redirects(self, client):
        resp = client.post("/download", data={"court": ""})
        assert resp.status_code == 301

    def test_update_db_post_redirects(self, client):
        resp = client.post("/update-db", data={"action": "quick_update"})
        assert resp.status_code == 301

    def test_pipeline_post_redirects(self, client):
        resp = client.post("/pipeline", data={"preset": "quick"})
        assert resp.status_code == 301


# ── Export routes (unchanged, functional) ────────────────────────────────


class TestExport:
    def test_export_csv(self, client):
        resp = client.get("/export/csv")
        assert resp.status_code == 200
        assert resp.content_type.startswith("text/csv")

    def test_export_csv_filtered(self, client):
        resp_all = client.get("/export/csv")
        resp_filtered = client.get("/export/csv?court=FCA")
        assert resp_filtered.status_code == 200
        all_lines = resp_all.data.decode().strip().split("\n")
        filtered_lines = resp_filtered.data.decode().strip().split("\n")
        assert len(filtered_lines) < len(all_lines)

    def test_export_json(self, client):
        resp = client.get("/export/json")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert "total_cases" in data
        assert "cases" in data

    def test_export_unknown_format_redirects(self, client):
        resp = client.get("/export/xml", follow_redirects=True)
        assert resp.status_code == 200


# ── JSON API routes (unchanged, functional) ───────────────────────────────


class TestApiRoutes:
    def test_job_status_api(self, client):
        resp = client.get("/api/job-status")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "running" in data

    def test_pipeline_status_api(self, client):
        resp = client.get("/api/pipeline-status")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "running" in data

    def test_pipeline_log_api(self, client):
        resp = client.get("/api/pipeline-log")
        assert resp.status_code == 200

    def test_pipeline_log_filter_params(self, client):
        resp = client.get("/api/pipeline-log?phase=crawl&level=error&limit=10")
        assert resp.status_code == 200

    def test_pipeline_action_stop(self, client):
        resp = client.post(
            "/api/pipeline-action",
            data=json.dumps({"action": "stop"}),
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert resp.get_json()["ok"] is True

    def test_pipeline_action_unknown(self, client):
        resp = client.post(
            "/api/pipeline-action",
            data=json.dumps({"action": "unknown"}),
            content_type="application/json",
        )
        assert resp.status_code == 400


# ── Security headers ───────────────────────────────────────────────────────


class TestSecurityHeaders:
    def test_redirect_response_has_security_headers(self, client):
        resp = client.get("/")
        for header in ("X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy"):
            assert header in resp.headers, f"Missing {header}"

    def test_api_response_has_security_headers(self, client):
        resp = client.get("/api/job-status")
        for header in ("X-Content-Type-Options", "X-Frame-Options"):
            assert header in resp.headers, f"Missing {header}"
