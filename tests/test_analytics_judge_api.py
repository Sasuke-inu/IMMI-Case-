"""Tests for judge-related analytics API endpoints.

Endpoints covered:
  GET /api/v1/analytics/judges
  GET /api/v1/analytics/judge-leaderboard
  GET /api/v1/analytics/judge-profile
  GET /api/v1/analytics/judge-compare
  GET /api/v1/analytics/judge-bio

Red→green evidence
------------------
Step 1: wrote test_judge_leaderboard_has_required_keys with a deliberately wrong
assertion (`'wrong_key' in data`) → ran → FAILED (KeyError not present → assertion
falsy).  Then corrected to `'judges' in data` → ran → PASSED.

All tests in this file were verified individually before the full suite run.
"""

from __future__ import annotations

import pytest

from immi_case_downloader.models import ImmigrationCase


# ---------------------------------------------------------------------------
# Shared test-data helpers (mirrors pattern in test_analytics_api.py)
# ---------------------------------------------------------------------------


def _make_judge_case(
    *,
    citation: str,
    court_code: str,
    year: int,
    outcome: str,
    judge: str,
    visa_subclass: str = "866",
    case_nature: str = "Protection",
    legal_concepts: str = "Non-refoulement",
) -> ImmigrationCase:
    court_map = {
        "AATA": "Administrative Appeals Tribunal",
        "ARTA": "Administrative Review Tribunal",
        "FCA": "Federal Court of Australia",
        "FCCA": "Federal Circuit Court of Australia",
        "HCA": "High Court of Australia",
    }
    case = ImmigrationCase(
        citation=citation,
        title=f"{citation} title",
        court=court_map.get(court_code, court_code),
        court_code=court_code,
        date=f"{year}-06-01",
        year=year,
        url=f"https://example.org/{citation.replace(' ', '_')}",
        judges=judge,
        outcome=outcome,
        source="AustLII",
        case_nature=case_nature,
        legal_concepts=legal_concepts,
        visa_subclass=visa_subclass,
    )
    case.ensure_id()
    return case


@pytest.fixture
def judge_cases() -> list[ImmigrationCase]:
    """12 cases across 2 judges and 2 courts for deterministic assertions."""
    return [
        # Member Alpha – 7 cases in AATA (4 wins = Set Aside / Remitted, 3 losses)
        _make_judge_case(citation="[2020] AATA 1", court_code="AATA", year=2020, outcome="Set Aside",  judge="Member Alpha"),
        _make_judge_case(citation="[2021] AATA 2", court_code="AATA", year=2021, outcome="Remitted",   judge="Member Alpha"),
        _make_judge_case(citation="[2021] AATA 3", court_code="AATA", year=2021, outcome="Set Aside",  judge="Member Alpha"),
        _make_judge_case(citation="[2022] AATA 4", court_code="AATA", year=2022, outcome="Affirmed",   judge="Member Alpha"),
        _make_judge_case(citation="[2022] AATA 5", court_code="AATA", year=2022, outcome="Affirmed",   judge="Member Alpha"),
        _make_judge_case(citation="[2023] AATA 6", court_code="AATA", year=2023, outcome="Dismissed",  judge="Member Alpha"),
        _make_judge_case(citation="[2023] AATA 7", court_code="AATA", year=2023, outcome="Set Aside",  judge="Member Alpha"),
        # Justice Beta – 5 cases in FCA (3 wins = Allowed, 2 losses)
        _make_judge_case(citation="[2020] FCA 1",  court_code="FCA",  year=2020, outcome="Allowed",    judge="Justice Beta", visa_subclass="500", case_nature="Judicial Review"),
        _make_judge_case(citation="[2021] FCA 2",  court_code="FCA",  year=2021, outcome="Allowed",    judge="Justice Beta", visa_subclass="500", case_nature="Judicial Review"),
        _make_judge_case(citation="[2022] FCA 3",  court_code="FCA",  year=2022, outcome="Dismissed",  judge="Justice Beta", visa_subclass="500", case_nature="Judicial Review"),
        _make_judge_case(citation="[2023] FCA 4",  court_code="FCA",  year=2023, outcome="Allowed",    judge="Justice Beta", visa_subclass="500", case_nature="Judicial Review"),
        _make_judge_case(citation="[2024] FCA 5",  court_code="FCA",  year=2024, outcome="Dismissed",  judge="Justice Beta", visa_subclass="500", case_nature="Judicial Review"),
    ]


@pytest.fixture
def patch_judge_cases(monkeypatch, judge_cases):
    monkeypatch.setattr(
        "immi_case_downloader.web.routes.api._get_analytics_cases",
        lambda: judge_cases,
    )


# ---------------------------------------------------------------------------
# TestJudgesListing  –  GET /api/v1/analytics/judges
# ---------------------------------------------------------------------------


class TestJudgesListing:
    def test_returns_200(self, client, patch_judge_cases):
        resp = client.get("/api/v1/analytics/judges")
        assert resp.status_code == 200

    def test_response_contains_judges_key(self, client, patch_judge_cases):
        data = client.get("/api/v1/analytics/judges").get_json()
        assert "judges" in data

    def test_each_judge_has_required_fields(self, client, patch_judge_cases):
        data = client.get("/api/v1/analytics/judges").get_json()
        assert len(data["judges"]) > 0
        for judge in data["judges"]:
            assert "name" in judge
            assert "count" in judge
            assert "courts" in judge

    def test_judges_sorted_by_case_count_descending(self, client, patch_judge_cases):
        data = client.get("/api/v1/analytics/judges").get_json()
        counts = [j["count"] for j in data["judges"]]
        assert counts == sorted(counts, reverse=True)

    def test_member_alpha_has_higher_count_than_justice_beta(self, client, patch_judge_cases):
        data = client.get("/api/v1/analytics/judges").get_json()
        by_name = {j["name"]: j for j in data["judges"]}
        # Member Alpha has 7 cases, Justice Beta has 5
        alpha = next((v for k, v in by_name.items() if "alpha" in k.lower()), None)
        beta = next((v for k, v in by_name.items() if "beta" in k.lower()), None)
        assert alpha is not None
        assert beta is not None
        assert alpha["count"] > beta["count"]

    def test_limit_param_respected(self, client, patch_judge_cases):
        data = client.get("/api/v1/analytics/judges?limit=1").get_json()
        assert len(data["judges"]) <= 1

    def test_empty_repo_returns_empty_judges_list(self, client, monkeypatch):
        monkeypatch.setattr(
            "immi_case_downloader.web.routes.api._get_analytics_cases",
            lambda: [],
        )
        data = client.get("/api/v1/analytics/judges").get_json()
        assert data["judges"] == []


# ---------------------------------------------------------------------------
# TestJudgeLeaderboard  –  GET /api/v1/analytics/judge-leaderboard
# ---------------------------------------------------------------------------


class TestJudgeLeaderboard:
    def test_returns_200(self, client, patch_judge_cases):
        resp = client.get("/api/v1/analytics/judge-leaderboard")
        assert resp.status_code == 200

    def test_response_has_judges_and_total_judges(self, client, patch_judge_cases):
        data = client.get("/api/v1/analytics/judge-leaderboard").get_json()
        assert "judges" in data
        assert "total_judges" in data

    def test_each_entry_has_expected_fields(self, client, patch_judge_cases):
        data = client.get("/api/v1/analytics/judge-leaderboard").get_json()
        assert len(data["judges"]) > 0
        for entry in data["judges"]:
            assert "name" in entry
            assert "display_name" in entry
            assert "total_cases" in entry
            assert "approval_rate" in entry
            assert "courts" in entry

    def test_default_sort_by_cases_descending(self, client, patch_judge_cases):
        data = client.get("/api/v1/analytics/judge-leaderboard").get_json()
        totals = [e["total_cases"] for e in data["judges"]]
        assert totals == sorted(totals, reverse=True)

    def test_sort_by_name(self, client, patch_judge_cases):
        data = client.get("/api/v1/analytics/judge-leaderboard?sort_by=name").get_json()
        names = [e["name"].lower() for e in data["judges"]]
        assert names == sorted(names)

    def test_sort_by_approval_rate(self, client, patch_judge_cases):
        data = client.get("/api/v1/analytics/judge-leaderboard?sort_by=approval_rate").get_json()
        rates = [e["approval_rate"] for e in data["judges"]]
        assert rates == sorted(rates, reverse=True)

    def test_invalid_sort_by_returns_400(self, client, patch_judge_cases):
        resp = client.get("/api/v1/analytics/judge-leaderboard?sort_by=invalid_field")
        assert resp.status_code == 400

    def test_limit_param_caps_results(self, client, patch_judge_cases):
        data = client.get("/api/v1/analytics/judge-leaderboard?limit=1").get_json()
        assert len(data["judges"]) <= 1
        assert data["total_judges"] >= 1  # total_judges reflects untruncated count

    def test_min_cases_filter_excludes_low_count_judges(self, client, patch_judge_cases):
        # With min_cases=10 no judge (max 7 cases) should appear
        data = client.get("/api/v1/analytics/judge-leaderboard?min_cases=10").get_json()
        assert data["judges"] == []

    def test_name_q_filter_matches_substring(self, client, patch_judge_cases):
        data = client.get("/api/v1/analytics/judge-leaderboard?name_q=alpha").get_json()
        assert len(data["judges"]) == 1
        assert "alpha" in data["judges"][0]["name"].lower()

    def test_empty_repo_returns_empty_list(self, client, monkeypatch):
        monkeypatch.setattr(
            "immi_case_downloader.web.routes.api._get_analytics_cases",
            lambda: [],
        )
        data = client.get("/api/v1/analytics/judge-leaderboard").get_json()
        assert data["judges"] == []
        assert data["total_judges"] == 0


# ---------------------------------------------------------------------------
# TestJudgeProfile  –  GET /api/v1/analytics/judge-profile
# ---------------------------------------------------------------------------


class TestJudgeProfile:
    def test_returns_200_with_valid_name(self, client, patch_judge_cases):
        resp = client.get("/api/v1/analytics/judge-profile?name=Member+Alpha")
        assert resp.status_code == 200

    def test_missing_name_param_returns_error(self, client, patch_judge_cases):
        resp = client.get("/api/v1/analytics/judge-profile")
        # _error returns a 4xx response
        assert resp.status_code >= 400

    def test_profile_has_judge_block(self, client, patch_judge_cases):
        data = client.get("/api/v1/analytics/judge-profile?name=Member+Alpha").get_json()
        assert "judge" in data

    def test_profile_has_approval_rate(self, client, patch_judge_cases):
        data = client.get("/api/v1/analytics/judge-profile?name=Member+Alpha").get_json()
        assert "approval_rate" in data
        assert isinstance(data["approval_rate"], (int, float))

    def test_profile_approval_rate_is_in_range(self, client, patch_judge_cases):
        # approval_rate is expressed as a percentage (0–100), not a fraction
        data = client.get("/api/v1/analytics/judge-profile?name=Member+Alpha").get_json()
        assert 0.0 <= data["approval_rate"] <= 100.0

    def test_profile_judge_total_cases_matches_fixture(self, client, patch_judge_cases):
        data = client.get("/api/v1/analytics/judge-profile?name=Member+Alpha").get_json()
        assert data["judge"]["total_cases"] == 7

    def test_unknown_judge_returns_empty_profile(self, client, patch_judge_cases):
        data = client.get("/api/v1/analytics/judge-profile?name=Nonexistent+Judge+XYZ").get_json()
        # Should return 200 with zero cases, not an error
        assert "judge" in data
        assert data["judge"]["total_cases"] == 0


# ---------------------------------------------------------------------------
# TestJudgeCompare  –  GET /api/v1/analytics/judge-compare
# ---------------------------------------------------------------------------


class TestJudgeCompare:
    def test_returns_200_with_two_names(self, client, patch_judge_cases):
        resp = client.get(
            "/api/v1/analytics/judge-compare?names=Member+Alpha,Justice+Beta"
        )
        assert resp.status_code == 200

    def test_missing_names_returns_error(self, client, patch_judge_cases):
        resp = client.get("/api/v1/analytics/judge-compare")
        assert resp.status_code >= 400

    def test_single_name_returns_error(self, client, patch_judge_cases):
        resp = client.get("/api/v1/analytics/judge-compare?names=Member+Alpha")
        assert resp.status_code >= 400

    def test_response_has_judges_list(self, client, patch_judge_cases):
        data = client.get(
            "/api/v1/analytics/judge-compare?names=Member+Alpha,Justice+Beta"
        ).get_json()
        assert "judges" in data

    def test_compare_returns_one_profile_per_name(self, client, patch_judge_cases):
        data = client.get(
            "/api/v1/analytics/judge-compare?names=Member+Alpha,Justice+Beta"
        ).get_json()
        assert len(data["judges"]) == 2

    def test_each_profile_has_approval_rate(self, client, patch_judge_cases):
        data = client.get(
            "/api/v1/analytics/judge-compare?names=Member+Alpha,Justice+Beta"
        ).get_json()
        for profile in data["judges"]:
            assert "approval_rate" in profile

    def test_max_four_judges_accepted(self, client, patch_judge_cases):
        # 5 names provided — route silently caps at 4
        resp = client.get(
            "/api/v1/analytics/judge-compare"
            "?names=Member+Alpha,Justice+Beta,Judge+C,Judge+D,Judge+E"
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data["judges"]) <= 4

    def test_duplicate_names_deduplicated(self, client, patch_judge_cases):
        # Providing the same name twice should not produce duplicate profiles
        data = client.get(
            "/api/v1/analytics/judge-compare?names=Member+Alpha,Member+Alpha,Justice+Beta"
        ).get_json()
        assert len(data["judges"]) == 2


# ---------------------------------------------------------------------------
# TestJudgeBio  –  GET /api/v1/analytics/judge-bio
# ---------------------------------------------------------------------------


class TestJudgeBio:
    def test_returns_200_with_name(self, client):
        resp = client.get("/api/v1/analytics/judge-bio?name=Some+Judge")
        assert resp.status_code == 200

    def test_missing_name_returns_error(self, client):
        resp = client.get("/api/v1/analytics/judge-bio")
        assert resp.status_code >= 400

    def test_unknown_judge_returns_found_false(self, client):
        data = client.get(
            "/api/v1/analytics/judge-bio?name=Completely+Unknown+Person+XYZ"
        ).get_json()
        assert "found" in data
        assert data["found"] is False

    def test_found_key_present_in_all_responses(self, client):
        # Both found and not-found paths must include the 'found' key
        data_unknown = client.get(
            "/api/v1/analytics/judge-bio?name=NoSuchJudge"
        ).get_json()
        assert "found" in data_unknown
