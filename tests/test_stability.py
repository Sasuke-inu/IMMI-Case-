"""Tests for Phase 1: Stability & Thread Safety.

Covers:
- Issue 1.1: Thread safety for _job_status (CWE-362)
- Issue 1.2: Input validation — safe_int / safe_float (CWE-20)
- Issue 1.3: Path traversal prevention (CWE-22)
- Issue 1.4: Mass assignment prevention in update_case (CWE-915)
- Issue 1.5: Atomic CSV/JSON writes
"""

import os
import threading
import time
from unittest.mock import patch

import pytest

from immi_case_downloader.models import ImmigrationCase
from immi_case_downloader.storage import (
    get_case_full_text,
    save_case_text,
    save_cases_csv,
    save_cases_json,
    update_case,
    load_all_cases,
    ensure_output_dirs,
)


# ── Issue 1.1: Thread Safety ───────────────────────────────────────────────


class TestThreadSafety:
    """Verify _job_status uses a lock for thread-safe operations."""

    def test_job_lock_exists(self):
        """webapp module should export a _job_lock threading.Lock."""
        from immi_case_downloader import webapp
        assert hasattr(webapp, "_job_lock"), "_job_lock not defined in webapp"
        assert isinstance(webapp._job_lock, type(threading.Lock()))

    def test_concurrent_job_start_prevented(self, client):
        """Legacy POST /search no longer starts jobs — redirects to React SPA.

        Job management is now handled via the React SPA + JSON API layer.
        The redirect ensures no accidental double-submit from old form URLs.
        """
        from immi_case_downloader import webapp

        with webapp._job_lock:
            webapp._job_status["running"] = True

        try:
            resp = client.post("/search", data={
                "databases": ["AATA"],
                "start_year": "2024",
                "end_year": "2024",
                "max_results": "10",
            }, follow_redirects=False)
            # POST to legacy route returns 301 redirect — no job processing
            assert resp.status_code == 301
        finally:
            with webapp._job_lock:
                webapp._job_status["running"] = False

    def test_job_status_api_returns_consistent_snapshot(self, client):
        """GET /api/job-status should return a snapshot, not a live reference."""
        resp = client.get("/api/job-status")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "running" in data
        assert "progress" in data


# ── Issue 1.2: Input Validation ────────────────────────────────────────────


class TestSafeIntFloat:
    """Verify safe_int and safe_float helper functions."""

    def test_safe_int_valid(self):
        from immi_case_downloader.webapp import safe_int
        assert safe_int("42", default=0) == 42
        assert safe_int("0", default=5) == 0

    def test_safe_int_invalid_returns_default(self):
        from immi_case_downloader.webapp import safe_int
        assert safe_int("abc", default=10) == 10
        assert safe_int("", default=5) == 5
        assert safe_int(None, default=7) == 7

    def test_safe_int_respects_min_max(self):
        from immi_case_downloader.webapp import safe_int
        assert safe_int("999", default=0, min_val=0, max_val=100) == 100
        assert safe_int("-5", default=0, min_val=0, max_val=100) == 0
        assert safe_int("50", default=0, min_val=0, max_val=100) == 50

    def test_safe_float_valid(self):
        from immi_case_downloader.webapp import safe_float
        assert safe_float("1.5", default=0.0) == 1.5

    def test_safe_float_invalid_returns_default(self):
        from immi_case_downloader.webapp import safe_float
        assert safe_float("abc", default=0.5) == 0.5

    def test_safe_float_respects_min_max(self):
        from immi_case_downloader.webapp import safe_float
        assert safe_float("0.01", default=0.5, min_val=0.3) == 0.3
        assert safe_float("99.0", default=0.5, max_val=5.0) == 5.0

    def test_search_form_invalid_year_no_500(self, client):
        """POST to /search (legacy) returns 301 redirect — no 500 possible."""
        resp = client.post("/search", data={
            "databases": ["AATA"],
            "start_year": "abc",
            "end_year": "xyz",
            "max_results": "not_a_number",
        }, follow_redirects=False)
        assert resp.status_code == 301

    def test_delay_minimum_enforced(self, client):
        """delay values below 0.3 should be clamped to minimum."""
        from immi_case_downloader.webapp import safe_float
        assert safe_float("0.001", default=0.5, min_val=0.3) == 0.3


# ── Issue 1.3: Path Traversal ──────────────────────────────────────────────


class TestPathTraversal:
    """Verify path traversal is blocked in storage functions."""

    def test_path_traversal_blocked(self, populated_dir, sample_cases):
        """Attempting to read ../../etc/passwd should return None."""
        case = sample_cases[0]
        case.full_text_path = "../../etc/passwd"
        result = get_case_full_text(case, base_dir=str(populated_dir))
        assert result is None, "Path traversal should be blocked"

    def test_absolute_path_outside_dir_blocked(self, populated_dir, sample_cases):
        """Absolute path outside output dir should return None."""
        case = sample_cases[0]
        case.full_text_path = "/etc/passwd"
        result = get_case_full_text(case, base_dir=str(populated_dir))
        assert result is None, "Absolute path outside output dir should be blocked"

    def test_valid_path_within_output_dir(self, populated_dir, sample_cases):
        """Valid file path within output dir should be readable."""
        case = sample_cases[0]
        ensure_output_dirs(str(populated_dir))
        filepath = save_case_text(case, "Test content", str(populated_dir))
        case.full_text_path = filepath
        result = get_case_full_text(case, base_dir=str(populated_dir))
        assert result is not None
        assert "Test content" in result

    def test_save_case_text_path_validation(self, populated_dir, sample_cases):
        """save_case_text should sanitize filenames properly."""
        case = sample_cases[0]
        case.citation = "../../../evil"
        ensure_output_dirs(str(populated_dir))
        filepath = save_case_text(case, "content", str(populated_dir))
        # File should be created within the text directory, not escape
        assert str(populated_dir) in os.path.realpath(filepath)


# ── Issue 1.4: Mass Assignment ─────────────────────────────────────────────


class TestMassAssignment:
    """Verify update_case() uses field whitelist."""

    def test_update_case_allowed_fields(self, populated_dir, sample_cases):
        """Allowed fields (title, user_notes, tags) should be updatable."""
        case_id = sample_cases[0].case_id
        result = update_case(
            case_id,
            {"title": "Updated Title", "user_notes": "My note", "tags": "important"},
            str(populated_dir),
        )
        assert result is True
        cases = load_all_cases(str(populated_dir))
        updated = next(c for c in cases if c.case_id == case_id)
        assert updated.title == "Updated Title"
        assert updated.user_notes == "My note"

    def test_update_case_blocked_fields(self, populated_dir, sample_cases):
        """Sensitive fields (case_id, full_text_path, source) should be ignored."""
        case_id = sample_cases[0].case_id
        original_source = sample_cases[0].source
        result = update_case(
            case_id,
            {
                "full_text_path": "/etc/passwd",
                "source": "HACKED",
                "case_id": "evil_id",
            },
            str(populated_dir),
        )
        # Should succeed but sensitive fields should not change
        cases = load_all_cases(str(populated_dir))
        updated = next(c for c in cases if c.case_id == case_id)
        assert updated.full_text_path != "/etc/passwd"
        assert updated.source == original_source


# ── Issue 1.5: Atomic Writes ──────────────────────────────────────────────


class TestAtomicWrites:
    """Verify CSV/JSON writes are atomic (write-tmp-then-rename)."""

    def test_csv_write_atomic(self, populated_dir, sample_cases):
        """If write fails mid-way, original CSV should remain intact."""
        csv_path = os.path.join(str(populated_dir), "immigration_cases.csv")
        tmp_path = csv_path + ".tmp"

        # Save initial data
        save_cases_csv(sample_cases, str(populated_dir))
        original_size = os.path.getsize(csv_path)

        # Simulate a write failure on the .tmp file
        original_to_csv = __import__("pandas").DataFrame.to_csv

        def failing_to_csv(self, path, **kwargs):
            if str(path).endswith(".tmp"):
                raise IOError("disk full")
            return original_to_csv(self, path, **kwargs)

        with patch("pandas.DataFrame.to_csv", failing_to_csv):
            try:
                save_cases_csv(sample_cases[:1], str(populated_dir))
            except IOError:
                pass

        # Original CSV should still be intact (atomic: .tmp failed, original untouched)
        assert os.path.exists(csv_path)
        assert os.path.getsize(csv_path) == original_size
        # No leftover .tmp file
        assert not os.path.exists(tmp_path)

    def test_json_write_atomic(self, populated_dir, sample_cases):
        """If JSON write fails, original file should remain."""
        json_path = os.path.join(str(populated_dir), "immigration_cases.json")
        tmp_path = json_path + ".tmp"

        save_cases_json(sample_cases, str(populated_dir))
        with open(json_path) as f:
            original_content = f.read()

        # Mock open to fail only for .tmp files
        real_open = open

        def failing_open(path, *args, **kwargs):
            if str(path).endswith(".tmp"):
                raise IOError("disk full")
            return real_open(path, *args, **kwargs)

        with patch("builtins.open", failing_open):
            try:
                save_cases_json(sample_cases[:1], str(populated_dir))
            except IOError:
                pass

        # Original JSON should still be intact
        assert os.path.exists(json_path)
        with open(json_path) as f:
            assert f.read() == original_content

    def test_csv_no_leftover_tmp(self, populated_dir, sample_cases):
        """Successful write should not leave .tmp files behind."""
        save_cases_csv(sample_cases, str(populated_dir))
        tmp_files = [f for f in os.listdir(str(populated_dir)) if f.endswith(".tmp")]
        assert len(tmp_files) == 0, f"Leftover .tmp files: {tmp_files}"
