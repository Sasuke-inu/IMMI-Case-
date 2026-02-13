"""Tests for TTL cache in storage.load_all_cases."""

import time

from immi_case_downloader.models import ImmigrationCase
from immi_case_downloader.storage import (
    ensure_output_dirs,
    save_cases_csv,
    load_all_cases,
    invalidate_cases_cache,
    _cases_cache,
    _cases_cache_lock,
    _CACHE_TTL,
)


class TestCasesCacheTTL:
    def test_cache_returns_same_data(self, tmp_path):
        """Second call returns cached data without re-reading CSV."""
        ensure_output_dirs(str(tmp_path))
        case = ImmigrationCase(citation="[2024] TEST 1", url="https://example.com/1", court_code="AATA")
        case.ensure_id()
        save_cases_csv([case], str(tmp_path))

        result1 = load_all_cases(str(tmp_path))
        result2 = load_all_cases(str(tmp_path))
        assert len(result1) == len(result2) == 1
        assert result1[0].citation == result2[0].citation

    def test_cache_returns_copy(self, tmp_path):
        """Modifying returned list does not affect cache."""
        ensure_output_dirs(str(tmp_path))
        case = ImmigrationCase(citation="[2024] TEST 2", url="https://example.com/2", court_code="AATA")
        case.ensure_id()
        save_cases_csv([case], str(tmp_path))

        result1 = load_all_cases(str(tmp_path))
        result1.clear()  # mutate
        result2 = load_all_cases(str(tmp_path))
        assert len(result2) == 1  # cache unaffected

    def test_invalidate_clears_cache(self, tmp_path):
        """invalidate_cases_cache() forces re-read on next call."""
        ensure_output_dirs(str(tmp_path))
        case = ImmigrationCase(citation="[2024] TEST 3", url="https://example.com/3", court_code="AATA")
        case.ensure_id()
        save_cases_csv([case], str(tmp_path))

        load_all_cases(str(tmp_path))  # populate cache
        with _cases_cache_lock:
            assert _cases_cache["cases"] is not None

        invalidate_cases_cache()
        with _cases_cache_lock:
            assert _cases_cache["cases"] is None

    def test_save_invalidates_cache(self, tmp_path):
        """save_cases_csv() automatically invalidates cache."""
        ensure_output_dirs(str(tmp_path))
        case = ImmigrationCase(citation="[2024] TEST 4", url="https://example.com/4", court_code="AATA")
        case.ensure_id()
        save_cases_csv([case], str(tmp_path))

        load_all_cases(str(tmp_path))  # populate cache
        with _cases_cache_lock:
            assert _cases_cache["cases"] is not None

        # Add another case
        case2 = ImmigrationCase(citation="[2024] TEST 5", url="https://example.com/5", court_code="FCA")
        case2.ensure_id()
        save_cases_csv([case, case2], str(tmp_path))

        # Cache should have been invalidated by save
        result = load_all_cases(str(tmp_path))
        assert len(result) == 2

    def test_different_base_dir_not_cached(self, tmp_path):
        """Different base_dir triggers fresh load."""
        dir1 = tmp_path / "dir1"
        dir2 = tmp_path / "dir2"
        ensure_output_dirs(str(dir1))
        ensure_output_dirs(str(dir2))

        case1 = ImmigrationCase(citation="[2024] A 1", url="https://a.com/1", court_code="AATA")
        case1.ensure_id()
        save_cases_csv([case1], str(dir1))

        case2 = ImmigrationCase(citation="[2024] B 1", url="https://b.com/1", court_code="FCA")
        case2.ensure_id()
        save_cases_csv([case2], str(dir2))

        result1 = load_all_cases(str(dir1))
        result2 = load_all_cases(str(dir2))
        assert result1[0].court_code == "AATA"
        assert result2[0].court_code == "FCA"

    def test_cache_ttl_is_positive(self):
        """Cache TTL should be a positive number."""
        assert _CACHE_TTL > 0
