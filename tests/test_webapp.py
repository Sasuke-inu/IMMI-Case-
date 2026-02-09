"""Tests for immi_case_downloader.webapp — frontend fixes B1-B8."""

import json
from unittest.mock import patch

import pytest

from immi_case_downloader.config import AUSTLII_DATABASES
from immi_case_downloader.models import ImmigrationCase
from immi_case_downloader.storage import (
    ensure_output_dirs,
    save_cases_csv,
    save_cases_json,
    save_case_text,
)


# ── W01-W02: Basic rendering ────────────────────────────────────────────

class TestBasicRendering:
    def test_dashboard_renders(self, client):
        """W01: Dashboard returns 200 and shows stats."""
        resp = client.get("/")
        assert resp.status_code == 200
        assert b"Total Cases" in resp.data or b"Welcome" in resp.data

    def test_case_list_renders(self, client, sample_cases):
        """W02: Case list shows case citations."""
        resp = client.get("/cases")
        assert resp.status_code == 200
        assert sample_cases[0].citation.encode() in resp.data


# ── W03-W05: Page parameter validation (B4) ─────────────────────────────

class TestPageValidation:
    def test_page_string_does_not_crash(self, client):
        """W03: ?page=abc should not cause 500."""
        resp = client.get("/cases?page=abc")
        assert resp.status_code == 200

    def test_page_negative_normalizes(self, client):
        """W04: ?page=-5 normalizes to page 1."""
        resp = client.get("/cases?page=-5")
        assert resp.status_code == 200
        assert b"Browse Cases" in resp.data

    def test_page_beyond_max_normalizes(self, client):
        """W05: ?page=9999 normalizes to last page."""
        resp = client.get("/cases?page=9999")
        assert resp.status_code == 200


# ── W06: Single load (B2) ───────────────────────────────────────────────

class TestSingleLoad:
    def test_case_list_loads_data_once(self, app):
        """W06: case_list only calls load_all_cases once, not twice."""
        with app.test_client() as c:
            with patch("immi_case_downloader.webapp.load_all_cases", wraps=__import__("immi_case_downloader.storage", fromlist=["load_all_cases"]).load_all_cases) as mock_load:
                c.get("/cases")
                assert mock_load.call_count == 1, (
                    f"load_all_cases called {mock_load.call_count} times, expected 1"
                )


# ── W07-W08: Filters ────────────────────────────────────────────────────

class TestFilters:
    def test_court_filter(self, client, sample_cases):
        """W07: Court filter returns only matching cases."""
        resp = client.get("/cases?court=FCA")
        assert resp.status_code == 200
        # FCA case should appear
        fca_case = next(c for c in sample_cases if c.court_code == "FCA")
        assert fca_case.citation.encode() in resp.data
        # AATA case should NOT appear in the table rows
        aata_case = next(c for c in sample_cases if c.court_code == "AATA")
        # The AATA citation should not appear as a link in the results
        assert f'>{aata_case.citation}</a>'.encode() not in resp.data

    def test_keyword_filter(self, client, sample_cases):
        """W08: Keyword search matches title."""
        resp = client.get("/cases?q=Applicant+0")
        assert resp.status_code == 200
        assert b"Applicant 0" in resp.data


# ── W09: XSS prevention (B1) ────────────────────────────────────────────

class TestXSSPrevention:
    def test_full_text_script_escaped(self, app, populated_dir, sample_cases):
        """W09: <script> in full text must be escaped in HTML output."""
        case = sample_cases[0]
        ensure_output_dirs(str(populated_dir))
        save_case_text(case, '<script>alert("xss")</script>Some text', str(populated_dir))
        save_cases_csv(sample_cases, str(populated_dir))

        with app.test_client() as c:
            resp = c.get(f"/cases/{case.case_id}")
            assert resp.status_code == 200
            # Raw <script> must NOT appear — should be escaped
            assert b'<script>alert("xss")</script>' not in resp.data
            # Escaped version should appear
            assert b'&lt;script&gt;' in resp.data


# ── W10-W12: Export (B8) ────────────────────────────────────────────────

class TestExport:
    def test_export_csv(self, client):
        """W10: CSV export returns a file."""
        resp = client.get("/export/csv")
        assert resp.status_code == 200
        assert resp.content_type.startswith("text/csv")

    def test_export_csv_filtered(self, client, sample_cases):
        """W11: CSV export with court filter returns subset."""
        resp_all = client.get("/export/csv")
        resp_filtered = client.get("/export/csv?court=FCA")
        assert resp_filtered.status_code == 200
        # Filtered should have fewer rows
        all_lines = resp_all.data.decode().strip().split("\n")
        filtered_lines = resp_filtered.data.decode().strip().split("\n")
        assert len(filtered_lines) < len(all_lines)

    def test_export_json(self, client):
        """W12: JSON export returns valid JSON."""
        resp = client.get("/export/json")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert "total_cases" in data
        assert "cases" in data


# ── W13: Federal Court default unchecked (B5) ───────────────────────────

class TestSearchPage:
    def test_fedcourt_not_checked_by_default(self, client):
        """W13: Federal Court checkbox should not be pre-checked."""
        resp = client.get("/search")
        assert resp.status_code == 200
        html = resp.data.decode()
        import re
        # Match the input tag for fedcourt and check for standalone `checked` attribute
        # (not `this.checked` in JS). The HTML attribute `checked` appears as a
        # standalone word or as `checked="..."`, not inside `.checked`.
        match = re.search(r'<input[^>]*value="fedcourt"[^>]*>', html, re.DOTALL)
        assert match is not None, "fedcourt checkbox not found"
        tag = match.group(0)
        # Remove JS event handlers before checking for the `checked` attribute
        tag_no_js = re.sub(r'on\w+="[^"]*"', '', tag)
        assert " checked" not in tag_no_js, f"fedcourt should not be checked: {tag_no_js}"


# ── W14: Dynamic court codes (B7) ───────────────────────────────────────

class TestDynamicCourtCodes:
    def test_case_add_has_all_databases(self, client):
        """W14: Add case page includes all AUSTLII_DATABASES codes."""
        resp = client.get("/cases/add")
        assert resp.status_code == 200
        html = resp.data.decode()
        for code in AUSTLII_DATABASES:
            assert code in html, f"Court code {code} missing from add case page"
