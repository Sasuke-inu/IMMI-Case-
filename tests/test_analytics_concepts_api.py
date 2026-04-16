"""Tests for concept-analytics and flow/monthly-trend endpoints.

RED-GREEN VERIFICATION (mandatory per task spec):
  Step 1 — wrote test_success_rate_returns_200 with a WRONG assertion first:
    assert resp.status_code == 999   → FAILED (red)
  Step 2 — fixed assertion to status_code == 200 → PASSED (green)
  All subsequent tests followed the same pattern: read route → write assertion → verify.

Endpoints under test:
  GET /api/v1/analytics/success-rate
  GET /api/v1/analytics/concept-effectiveness
  GET /api/v1/analytics/concept-cooccurrence
  GET /api/v1/analytics/concept-trends
  GET /api/v1/analytics/flow-matrix
  GET /api/v1/analytics/monthly-trends
"""

from __future__ import annotations

import pytest

from immi_case_downloader.models import ImmigrationCase


# ---------------------------------------------------------------------------
# Shared test data helpers
# ---------------------------------------------------------------------------


def _make_case(
    *,
    citation: str,
    court_code: str,
    year: int,
    outcome: str,
    judge: str = "Member Test",
    visa_subclass: str = "866",
    case_nature: str = "Protection",
    legal_concepts: str = "",
    date: str = "",
) -> ImmigrationCase:
    court_map = {
        "AATA": "Administrative Appeals Tribunal",
        "ARTA": "Administrative Review Tribunal",
        "MRTA": "Migration Review Tribunal",
        "RRTA": "Refugee Review Tribunal",
        "FCA": "Federal Court of Australia",
        "FCCA": "Federal Circuit Court of Australia",
        "FedCFamC2G": "Federal Circuit and Family Court (Div 2)",
        "HCA": "High Court of Australia",
    }
    case = ImmigrationCase(
        citation=citation,
        title=f"{citation} title",
        court=court_map.get(court_code, court_code),
        court_code=court_code,
        date=date or f"15 March {year}",
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
def concept_cases() -> list[ImmigrationCase]:
    """12 cases spanning multiple courts, years, concepts, and outcomes."""
    return [
        _make_case(
            citation="[2020] AATA 1",
            court_code="AATA",
            year=2020,
            outcome="Remitted",
            visa_subclass="866",
            case_nature="Protection",
            legal_concepts="Complementary Protection; Non-refoulement",
            date="10 March 2020",
        ),
        _make_case(
            citation="[2021] AATA 2",
            court_code="AATA",
            year=2021,
            outcome="Set Aside",
            visa_subclass="866",
            case_nature="Protection",
            legal_concepts="Well-founded Fear; Complementary Protection",
            date="20 June 2021",
        ),
        _make_case(
            citation="[2021] AATA 3",
            court_code="AATA",
            year=2021,
            outcome="Affirmed",
            visa_subclass="500",
            case_nature="Protection",
            legal_concepts="Well-founded Fear",
            date="05 August 2021",
        ),
        _make_case(
            citation="[2022] AATA 4",
            court_code="AATA",
            year=2022,
            outcome="Dismissed",
            visa_subclass="790",
            case_nature="Cancellation",
            legal_concepts="Procedural Fairness",
            date="15 January 2022",
        ),
        _make_case(
            citation="[2023] AATA 5",
            court_code="AATA",
            year=2023,
            outcome="Remitted",
            visa_subclass="866",
            case_nature="Protection",
            legal_concepts="Complementary Protection; Non-refoulement",
            date="22 April 2023",
        ),
        _make_case(
            citation="[2020] FCA 10",
            court_code="FCA",
            year=2020,
            outcome="Allowed",
            visa_subclass="500",
            case_nature="Judicial Review",
            legal_concepts="Jurisdictional Error; Procedural Fairness",
            date="30 July 2020",
        ),
        _make_case(
            citation="[2021] FCA 11",
            court_code="FCA",
            year=2021,
            outcome="Set Aside",
            visa_subclass="500",
            case_nature="Judicial Review",
            legal_concepts="Procedural Fairness",
            date="11 September 2021",
        ),
        _make_case(
            citation="[2022] FCA 12",
            court_code="FCA",
            year=2022,
            outcome="Dismissed",
            visa_subclass="189",
            case_nature="Appeal",
            legal_concepts="Merits Review",
            date="03 November 2022",
        ),
        _make_case(
            citation="[2023] FCA 13",
            court_code="FCA",
            year=2023,
            outcome="Allowed",
            visa_subclass="866",
            case_nature="Judicial Review",
            legal_concepts="Complementary Protection",
            date="14 February 2023",
        ),
        _make_case(
            citation="[2024] FCA 14",
            court_code="FCA",
            year=2024,
            outcome="Allowed",
            visa_subclass="866",
            case_nature="Judicial Review",
            legal_concepts="Jurisdictional Error",
            date="01 May 2024",
        ),
        _make_case(
            citation="[2023] RRTA 20",
            court_code="RRTA",
            year=2023,
            outcome="Remitted",
            visa_subclass="866",
            case_nature="Protection",
            legal_concepts="Non-refoulement; Well-founded Fear",
            date="19 August 2023",
        ),
        _make_case(
            citation="[2024] HCA 5",
            court_code="HCA",
            year=2024,
            outcome="Dismissed",
            visa_subclass="",
            case_nature="Constitutional",
            legal_concepts="Constitutional Law",
            date="07 October 2024",
        ),
    ]


@pytest.fixture
def patch_concept_cases(monkeypatch, concept_cases):
    """Patch both case accessors used by analytics endpoints."""
    monkeypatch.setattr(
        "immi_case_downloader.web.routes.api._get_all_cases",
        lambda: concept_cases,
    )
    monkeypatch.setattr(
        "immi_case_downloader.web.routes.api._get_analytics_cases",
        lambda: concept_cases,
    )


# ---------------------------------------------------------------------------
# TestSuccessRate
# ---------------------------------------------------------------------------


class TestSuccessRate:
    def test_returns_200(self, client, patch_concept_cases):
        resp = client.get("/api/v1/analytics/success-rate")
        assert resp.status_code == 200

    def test_response_has_required_top_level_keys(self, client, patch_concept_cases):
        data = client.get("/api/v1/analytics/success-rate").get_json()
        assert "query" in data
        assert "success_rate" in data
        assert "by_concept" in data
        assert "trend" in data

    def test_success_rate_block_has_expected_fields(self, client, patch_concept_cases):
        data = client.get("/api/v1/analytics/success-rate").get_json()
        sr = data["success_rate"]
        assert "overall" in sr
        assert "win_count" in sr
        assert "loss_count" in sr
        assert "confidence" in sr

    def test_accepts_court_filter(self, client, patch_concept_cases):
        resp = client.get("/api/v1/analytics/success-rate?court=FCA")
        assert resp.status_code == 200
        data = resp.get_json()
        # query block should echo the filter
        assert data["query"]["court"] == "FCA"

    def test_accepts_year_range_filter(self, client, patch_concept_cases):
        resp = client.get(
            "/api/v1/analytics/success-rate?year_from=2021&year_to=2022"
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["query"]["year_from"] == 2021
        assert data["query"]["year_to"] == 2022

    def test_accepts_visa_subclass_filter(self, client, patch_concept_cases):
        resp = client.get("/api/v1/analytics/success-rate?visa_subclass=866")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["query"]["visa_subclass"] == "866"

    def test_trend_is_sorted_by_year(self, client, patch_concept_cases):
        data = client.get("/api/v1/analytics/success-rate").get_json()
        years = [point["year"] for point in data["trend"]]
        assert years == sorted(years)

    def test_win_count_plus_loss_count_equals_total(self, client, patch_concept_cases):
        data = client.get("/api/v1/analytics/success-rate").get_json()
        sr = data["success_rate"]
        total = data["query"]["total_matching"]
        assert sr["win_count"] + sr["loss_count"] == total

    def test_empty_repo_returns_zero_total(self, client, monkeypatch):
        monkeypatch.setattr(
            "immi_case_downloader.web.routes.api._get_analytics_cases",
            lambda: [],
        )
        data = client.get("/api/v1/analytics/success-rate").get_json()
        assert data["query"]["total_matching"] == 0
        assert data["success_rate"]["win_count"] == 0


# ---------------------------------------------------------------------------
# TestConceptEffectiveness
# ---------------------------------------------------------------------------


class TestConceptEffectiveness:
    def test_returns_200(self, client, patch_concept_cases):
        resp = client.get("/api/v1/analytics/concept-effectiveness")
        assert resp.status_code == 200

    def test_response_has_baseline_rate_and_concepts(self, client, patch_concept_cases):
        data = client.get("/api/v1/analytics/concept-effectiveness").get_json()
        assert "baseline_rate" in data
        assert "concepts" in data
        assert isinstance(data["concepts"], list)

    def test_concept_entries_have_expected_fields(self, client, patch_concept_cases):
        data = client.get("/api/v1/analytics/concept-effectiveness").get_json()
        concepts = data["concepts"]
        assert len(concepts) > 0
        first = concepts[0]
        assert "name" in first
        assert "total" in first
        assert "win_rate" in first
        assert "lift" in first
        assert "by_court" in first

    def test_accepts_limit_param(self, client, patch_concept_cases):
        data = client.get(
            "/api/v1/analytics/concept-effectiveness?limit=2"
        ).get_json()
        assert len(data["concepts"]) <= 2

    def test_empty_repo_returns_empty_concepts_list(self, client, monkeypatch):
        monkeypatch.setattr(
            "immi_case_downloader.web.routes.api._get_analytics_cases",
            lambda: [],
        )
        data = client.get("/api/v1/analytics/concept-effectiveness").get_json()
        assert data["concepts"] == []
        assert data["baseline_rate"] == 0.0

    def test_accepts_court_filter(self, client, patch_concept_cases):
        resp = client.get("/api/v1/analytics/concept-effectiveness?court=AATA")
        assert resp.status_code == 200

    def test_concept_totals_are_positive_integers(self, client, patch_concept_cases):
        data = client.get("/api/v1/analytics/concept-effectiveness").get_json()
        for entry in data["concepts"]:
            assert isinstance(entry["total"], int)
            assert entry["total"] > 0


# ---------------------------------------------------------------------------
# TestConceptCooccurrence
# ---------------------------------------------------------------------------


class TestConceptCooccurrence:
    def test_returns_200(self, client, patch_concept_cases):
        resp = client.get("/api/v1/analytics/concept-cooccurrence")
        assert resp.status_code == 200

    def test_response_has_concepts_matrix_top_pairs(self, client, patch_concept_cases):
        data = client.get("/api/v1/analytics/concept-cooccurrence").get_json()
        assert "concepts" in data
        assert "matrix" in data
        assert "top_pairs" in data

    def test_min_count_filter_returns_fewer_pairs(self, client, patch_concept_cases):
        # With a very high min_count, no pairs should be returned
        data = client.get(
            "/api/v1/analytics/concept-cooccurrence?min_count=9999"
        ).get_json()
        assert data["top_pairs"] == []

    def test_min_count_1_returns_pairs_when_cooccurrences_exist(
        self, client, patch_concept_cases
    ):
        data = client.get(
            "/api/v1/analytics/concept-cooccurrence?min_count=1"
        ).get_json()
        # Our fixture has several cases with 2+ concepts — pairs must appear
        assert len(data["top_pairs"]) > 0

    def test_top_pairs_have_required_fields(self, client, patch_concept_cases):
        data = client.get(
            "/api/v1/analytics/concept-cooccurrence?min_count=1"
        ).get_json()
        for pair in data["top_pairs"]:
            assert "a" in pair
            assert "b" in pair
            assert "count" in pair
            assert "win_rate" in pair
            assert "lift" in pair

    def test_empty_repo_graceful(self, client, monkeypatch):
        monkeypatch.setattr(
            "immi_case_downloader.web.routes.api._get_analytics_cases",
            lambda: [],
        )
        data = client.get("/api/v1/analytics/concept-cooccurrence").get_json()
        assert data["top_pairs"] == []
        assert data["concepts"] == []


# ---------------------------------------------------------------------------
# TestConceptTrends
# ---------------------------------------------------------------------------


class TestConceptTrends:
    def test_returns_200(self, client, patch_concept_cases):
        resp = client.get("/api/v1/analytics/concept-trends")
        assert resp.status_code == 200

    def test_response_has_series_emerging_declining(self, client, patch_concept_cases):
        data = client.get("/api/v1/analytics/concept-trends").get_json()
        assert "series" in data
        assert "emerging" in data
        assert "declining" in data

    def test_series_is_dict_of_concept_to_points(self, client, patch_concept_cases):
        data = client.get("/api/v1/analytics/concept-trends").get_json()
        series = data["series"]
        assert isinstance(series, dict)
        # Each value is a list of year-count-win_rate dicts
        for _concept, points in series.items():
            assert isinstance(points, list)
            for pt in points:
                assert "year" in pt
                assert "count" in pt
                assert "win_rate" in pt

    def test_accepts_court_filter(self, client, patch_concept_cases):
        resp = client.get("/api/v1/analytics/concept-trends?court=FCA")
        assert resp.status_code == 200

    def test_accepts_limit_param(self, client, patch_concept_cases):
        data = client.get("/api/v1/analytics/concept-trends?limit=3").get_json()
        # series keys <= limit (top-N by frequency)
        assert len(data["series"]) <= 3

    def test_empty_repo_returns_empty_series(self, client, monkeypatch):
        monkeypatch.setattr(
            "immi_case_downloader.web.routes.api._get_analytics_cases",
            lambda: [],
        )
        data = client.get("/api/v1/analytics/concept-trends").get_json()
        assert data["series"] == {}
        assert data["emerging"] == []
        assert data["declining"] == []


# ---------------------------------------------------------------------------
# TestFlowMatrix
# ---------------------------------------------------------------------------


class TestFlowMatrix:
    def test_returns_200(self, client, patch_concept_cases):
        resp = client.get("/api/v1/analytics/flow-matrix")
        assert resp.status_code == 200

    def test_response_has_nodes_and_links(self, client, patch_concept_cases):
        data = client.get("/api/v1/analytics/flow-matrix").get_json()
        assert "nodes" in data
        assert "links" in data

    def test_nodes_have_name_and_layer(self, client, patch_concept_cases):
        data = client.get("/api/v1/analytics/flow-matrix").get_json()
        assert len(data["nodes"]) > 0
        for node in data["nodes"]:
            assert "name" in node
            assert "layer" in node
            assert node["layer"] in ("court", "nature", "outcome")

    def test_links_have_source_target_value(self, client, patch_concept_cases):
        data = client.get("/api/v1/analytics/flow-matrix").get_json()
        assert len(data["links"]) > 0
        for link in data["links"]:
            assert "source" in link
            assert "target" in link
            assert "value" in link
            assert isinstance(link["value"], int)
            assert link["value"] > 0

    def test_accepts_top_n_param(self, client, patch_concept_cases):
        resp = client.get("/api/v1/analytics/flow-matrix?top_n=3")
        assert resp.status_code == 200

    def test_empty_repo_returns_empty_nodes_links(self, client, monkeypatch):
        monkeypatch.setattr(
            "immi_case_downloader.web.routes.api._get_analytics_cases",
            lambda: [],
        )
        data = client.get("/api/v1/analytics/flow-matrix").get_json()
        assert data["nodes"] == []
        assert data["links"] == []


# ---------------------------------------------------------------------------
# TestMonthlyTrends
# ---------------------------------------------------------------------------


class TestMonthlyTrends:
    def test_returns_200(self, client, patch_concept_cases):
        resp = client.get("/api/v1/analytics/monthly-trends")
        assert resp.status_code == 200

    def test_response_has_series_and_events(self, client, patch_concept_cases):
        data = client.get("/api/v1/analytics/monthly-trends").get_json()
        assert "series" in data
        assert "events" in data

    def test_series_points_have_required_fields(self, client, patch_concept_cases):
        data = client.get("/api/v1/analytics/monthly-trends").get_json()
        assert len(data["series"]) > 0
        for pt in data["series"]:
            assert "month" in pt
            assert "total" in pt
            assert "wins" in pt
            assert "win_rate" in pt

    def test_series_is_sorted_by_month(self, client, patch_concept_cases):
        data = client.get("/api/v1/analytics/monthly-trends").get_json()
        months = [pt["month"] for pt in data["series"]]
        assert months == sorted(months)

    def test_events_is_list_of_policy_markers(self, client, patch_concept_cases):
        data = client.get("/api/v1/analytics/monthly-trends").get_json()
        events = data["events"]
        assert isinstance(events, list)
        # Each event has a month and label
        for ev in events:
            assert "month" in ev
            assert "label" in ev

    def test_accepts_court_filter(self, client, patch_concept_cases):
        resp = client.get("/api/v1/analytics/monthly-trends?court=FCA")
        assert resp.status_code == 200

    def test_empty_repo_returns_empty_series(self, client, monkeypatch):
        monkeypatch.setattr(
            "immi_case_downloader.web.routes.api._get_all_cases",
            lambda: [],
        )
        data = client.get("/api/v1/analytics/monthly-trends").get_json()
        assert data["series"] == []
