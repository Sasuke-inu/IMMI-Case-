"""Export tests: CSV and JSON file download verification."""

import requests


class TestExportCSV:
    """CSV export via the API endpoint."""

    def test_csv_export_returns_200(self, base_url):
        resp = requests.get(f"{base_url}/api/v1/export/csv", timeout=10)
        assert resp.status_code == 200

    def test_csv_has_content_disposition(self, base_url):
        resp = requests.get(f"{base_url}/api/v1/export/csv", timeout=10)
        assert "content-disposition" in resp.headers
        assert "csv" in resp.headers["content-disposition"].lower()

    def test_csv_contains_headers(self, base_url):
        resp = requests.get(f"{base_url}/api/v1/export/csv", timeout=10)
        first_line = resp.text.split("\n")[0]
        assert "case_id" in first_line or "citation" in first_line


class TestExportJSON:
    """JSON export via the API endpoint."""

    def test_json_export_returns_200(self, base_url):
        resp = requests.get(f"{base_url}/api/v1/export/json", timeout=10)
        assert resp.status_code == 200

    def test_json_has_content_disposition(self, base_url):
        resp = requests.get(f"{base_url}/api/v1/export/json", timeout=10)
        assert "content-disposition" in resp.headers
        assert "json" in resp.headers["content-disposition"].lower()

    def test_json_is_valid(self, base_url):
        resp = requests.get(f"{base_url}/api/v1/export/json", timeout=10)
        data = resp.json()
        # API returns {exported_at, total_cases, cases: [...]}
        assert isinstance(data, dict)
        assert "cases" in data
        assert len(data["cases"]) == 10  # seed data
