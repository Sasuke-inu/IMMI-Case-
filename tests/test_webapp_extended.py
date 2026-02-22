"""Extended tests for immi_case_downloader.web — Phase 8 coverage (redirect architecture)."""

import json

# ── Route status codes ────────────────────────────────────────────────────


class TestRouteStatusCodes:
    """Verify routes return expected status codes under the redirect architecture."""

    # UI routes → 301 redirects
    def test_dashboard_redirects(self, client):
        assert client.get("/").status_code == 301

    def test_cases_redirects(self, client):
        assert client.get("/cases").status_code == 301

    def test_case_detail_redirects(self, client, sample_cases):
        resp = client.get(f"/cases/{sample_cases[0].case_id}")
        assert resp.status_code == 301

    def test_case_edit_get_redirects(self, client, sample_cases):
        resp = client.get(f"/cases/{sample_cases[0].case_id}/edit")
        assert resp.status_code == 301

    def test_case_add_get_redirects(self, client):
        assert client.get("/cases/add").status_code == 301

    def test_search_redirects(self, client):
        assert client.get("/search").status_code == 301

    def test_download_redirects(self, client):
        assert client.get("/download").status_code == 301

    def test_job_status_ui_redirects(self, client):
        assert client.get("/job-status").status_code == 301

    def test_data_dictionary_redirects(self, client):
        assert client.get("/data-dictionary").status_code == 301

    def test_update_db_redirects(self, client):
        assert client.get("/update-db").status_code == 301

    def test_pipeline_redirects(self, client):
        assert client.get("/pipeline").status_code == 301

    # JSON API routes → 200
    def test_job_status_api_ok(self, client):
        resp = client.get("/api/job-status")
        assert resp.status_code == 200
        assert "running" in resp.get_json()

    def test_pipeline_status_api_ok(self, client):
        resp = client.get("/api/pipeline-status")
        assert resp.status_code == 200
        assert "running" in resp.get_json()

    def test_pipeline_log_api_ok(self, client):
        assert client.get("/api/pipeline-log").status_code == 200

    def test_export_csv_ok(self, client):
        assert client.get("/export/csv").status_code == 200

    def test_export_json_ok(self, client):
        assert client.get("/export/json").status_code == 200

    def test_export_unknown_format_redirects(self, client):
        resp = client.get("/export/xml", follow_redirects=True)
        assert resp.status_code == 200

    def test_nonexistent_case_id_redirects(self, client):
        """Invalid case ID still returns a redirect (not 404/500)."""
        resp = client.get("/cases/nonexistent_id")
        assert resp.status_code in (301, 302)


# ── Pipeline JSON API ──────────────────────────────────────────────────────


class TestPipelineApi:
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

    def test_pipeline_log_filter(self, client):
        resp = client.get("/api/pipeline-log?phase=crawl&level=error&limit=10")
        assert resp.status_code == 200
