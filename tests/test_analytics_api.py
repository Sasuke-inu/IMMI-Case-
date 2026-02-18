"""Analytics API tests for success-rate, judge intelligence, and concept intelligence."""

from __future__ import annotations

from dataclasses import replace

import pytest

from immi_case_downloader.models import ImmigrationCase


# ---------------------------------------------------------------------------
# Test data helpers
# ---------------------------------------------------------------------------


def _make_case(
    *,
    citation: str,
    court_code: str,
    year: int,
    outcome: str,
    judge: str,
    visa_subclass: str = "",
    case_nature: str = "Protection Visa",
    legal_concepts: str = "",
) -> ImmigrationCase:
    court_map = {
        "AATA": "Administrative Appeals Tribunal",
        "ARTA": "Administrative Review Tribunal",
        "MRTA": "Migration Review Tribunal",
        "RRTA": "Refugee Review Tribunal",
        "FCA": "Federal Court of Australia",
        "FCCA": "Federal Circuit Court of Australia",
        "FMCA": "Federal Magistrates Court of Australia",
        "FedCFamC2G": "Federal Circuit and Family Court (Div 2)",
        "HCA": "High Court of Australia",
    }

    case = ImmigrationCase(
        citation=citation,
        title=f"{citation} title",
        court=court_map.get(court_code, court_code),
        court_code=court_code,
        date=f"{year}-01-01",
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
def analytics_cases() -> list[ImmigrationCase]:
    return [
        _make_case(
            citation="[2020] AATA 100",
            court_code="AATA",
            year=2020,
            outcome="Remitted",
            judge="Member Alpha",
            visa_subclass="866",
            case_nature="Protection",
            legal_concepts="Complementary Protection; Non-refoulement",
        ),
        _make_case(
            citation="[2021] AATA 101",
            court_code="AATA",
            year=2021,
            outcome="Set Aside",
            judge="Member Alpha",
            visa_subclass="866",
            case_nature="Protection",
            legal_concepts="Well-founded Fear; Complementary Protection",
        ),
        _make_case(
            citation="[2021] AATA 102",
            court_code="AATA",
            year=2021,
            outcome="Affirmed",
            judge="Member Alpha",
            visa_subclass="500",
            case_nature="Protection",
            legal_concepts="Well-founded Fear",
        ),
        _make_case(
            citation="[2022] AATA 103",
            court_code="AATA",
            year=2022,
            outcome="Dismissed",
            judge="Member Beta",
            visa_subclass="790",
            case_nature="Cancellation",
            legal_concepts="Procedural Fairness",
        ),
        _make_case(
            citation="[2023] ARTA 110",
            court_code="ARTA",
            year=2023,
            outcome="Remitted",
            judge="Member Alpha",
            visa_subclass="866",
            case_nature="Protection",
            legal_concepts="Complementary Protection; Non-refoulement",
        ),
        _make_case(
            citation="[2020] FCA 200",
            court_code="FCA",
            year=2020,
            outcome="Allowed",
            judge="Justice Gamma",
            visa_subclass="500",
            case_nature="Judicial Review",
            legal_concepts="Jurisdictional Error; Procedural Fairness",
        ),
        _make_case(
            citation="[2021] FCA 201",
            court_code="FCA",
            year=2021,
            outcome="Set Aside",
            judge="Justice Gamma",
            visa_subclass="500",
            case_nature="Judicial Review",
            legal_concepts="Procedural Fairness",
        ),
        _make_case(
            citation="[2022] FCA 202",
            court_code="FCA",
            year=2022,
            outcome="Dismissed",
            judge="Justice Delta",
            visa_subclass="189",
            case_nature="Appeal",
            legal_concepts="Merits Review",
        ),
        _make_case(
            citation="[2024] FCA 203",
            court_code="FCA",
            year=2024,
            outcome="Allowed",
            judge="Justice Delta",
            visa_subclass="866",
            case_nature="Judicial Review",
            legal_concepts="Complementary Protection",
        ),
        _make_case(
            citation="[2023] FedCFamC2G 300",
            court_code="FedCFamC2G",
            year=2023,
            outcome="Allowed",
            judge="Judge Epsilon",
            visa_subclass="500",
            case_nature="Judicial Review",
            legal_concepts="Jurisdictional Error",
        ),
        _make_case(
            citation="[2024] HCA 10",
            court_code="HCA",
            year=2024,
            outcome="Dismissed",
            judge="Chief Justice Zeta",
            visa_subclass="",
            case_nature="Constitutional",
            legal_concepts="Constitutional Law",
        ),
        _make_case(
            citation="[2024] RRTA 40",
            court_code="RRTA",
            year=2024,
            outcome="Remitted",
            judge="Member Beta",
            visa_subclass="866",
            case_nature="Protection",
            legal_concepts="Non-refoulement; Well-founded Fear",
        ),
    ]


@pytest.fixture
def patch_analytics_cases(monkeypatch, analytics_cases):
    monkeypatch.setattr(
        "immi_case_downloader.web.routes.api._get_all_cases",
        lambda: analytics_cases,
    )


# ---------------------------------------------------------------------------
# Phase 1: Success Rate Calculator
# ---------------------------------------------------------------------------


def test_success_rate_returns_200(client, patch_analytics_cases):
    resp = client.get("/api/v1/analytics/success-rate")
    assert resp.status_code == 200


def test_success_rate_has_required_fields(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/success-rate").get_json()
    assert "success_rate" in data
    assert "by_concept" in data
    assert "trend" in data


def test_success_rate_tribunal_win_definition(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/success-rate?court=AATA").get_json()
    assert data["success_rate"]["court_type"] == "tribunal"
    assert data["success_rate"]["win_outcomes"] == ["Remitted", "Set Aside"]
    assert data["success_rate"]["win_count"] == 2


def test_success_rate_court_win_definition(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/success-rate?court=FCA").get_json()
    assert data["success_rate"]["court_type"] == "court"
    assert data["success_rate"]["win_outcomes"] == ["Allowed", "Set Aside"]
    assert data["success_rate"]["win_count"] == 3


def test_success_rate_visa_filter(client, patch_analytics_cases):
    all_data = client.get("/api/v1/analytics/success-rate").get_json()
    filtered = client.get("/api/v1/analytics/success-rate?visa_subclass=866").get_json()

    assert filtered["query"]["total_matching"] < all_data["query"]["total_matching"]
    assert filtered["query"]["visa_subclass"] == "866"


def test_success_rate_concept_filter(client, patch_analytics_cases):
    all_data = client.get("/api/v1/analytics/success-rate").get_json()
    filtered = client.get(
        "/api/v1/analytics/success-rate?legal_concepts=complementary%20protection"
    ).get_json()

    assert filtered["query"]["total_matching"] < all_data["query"]["total_matching"]


def test_success_rate_confidence_levels(client, monkeypatch, analytics_cases):
    # >100 => high
    big = []
    for idx in range(120):
        template = analytics_cases[idx % len(analytics_cases)]
        big_case = replace(
            template,
            citation=f"[2024] BULK {idx}",
            url=f"https://example.org/bulk-{idx}",
        )
        big_case.ensure_id()
        big.append(big_case)

    monkeypatch.setattr("immi_case_downloader.web.routes.api._get_all_cases", lambda: big)
    high = client.get("/api/v1/analytics/success-rate").get_json()
    assert high["success_rate"]["confidence"] == "high"

    # <20 => low
    small = analytics_cases[:10]
    monkeypatch.setattr("immi_case_downloader.web.routes.api._get_all_cases", lambda: small)
    low = client.get("/api/v1/analytics/success-rate").get_json()
    assert low["success_rate"]["confidence"] == "low"


def test_success_rate_trend_is_sorted_by_year(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/success-rate").get_json()
    years = [item["year"] for item in data["trend"]]
    assert years == sorted(years)


def test_success_rate_empty_result(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/success-rate?visa_subclass=999").get_json()
    assert data["query"]["total_matching"] == 0
    assert data["success_rate"]["overall"] == 0


# ---------------------------------------------------------------------------
# Phase 2: Judge Intelligence
# ---------------------------------------------------------------------------


def test_judge_leaderboard_returns_list(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/judge-leaderboard").get_json()
    assert isinstance(data["judges"], list)


def test_judge_leaderboard_sorted_by_cases(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/judge-leaderboard?sort_by=cases").get_json()
    totals = [j["total_cases"] for j in data["judges"]]
    assert totals == sorted(totals, reverse=True)


def test_judge_leaderboard_sort_by_approval_rate(client, patch_analytics_cases):
    data = client.get(
        "/api/v1/analytics/judge-leaderboard?sort_by=approval_rate"
    ).get_json()
    rates = [j["approval_rate"] for j in data["judges"]]
    assert rates == sorted(rates, reverse=True)


def test_judge_leaderboard_court_filter(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/judge-leaderboard?court=AATA").get_json()
    assert data["judges"]
    assert all("AATA" in j["courts"] for j in data["judges"])


def test_judge_leaderboard_limit(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/judge-leaderboard?limit=2").get_json()
    assert len(data["judges"]) == 2


def test_judge_profile_known_judge(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/judge-profile?name=Member%20Alpha").get_json()
    assert data["judge"]["name"] == "Member Alpha"
    assert data["judge"]["total_cases"] > 0


def test_judge_profile_unknown_returns_empty(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/judge-profile?name=Unknown").get_json()
    assert data["judge"]["total_cases"] == 0
    assert data["outcome_distribution"] == {}


def test_judge_profile_has_outcome_distribution(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/judge-profile?name=Justice%20Gamma").get_json()
    assert data["outcome_distribution"]


def test_judge_profile_has_concept_effectiveness(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/judge-profile?name=Justice%20Gamma").get_json()
    assert "concept_effectiveness" in data
    assert isinstance(data["concept_effectiveness"], list)


def test_judge_profile_visa_breakdown_sorted(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/judge-profile?name=Member%20Alpha").get_json()
    totals = [item["total"] for item in data["visa_breakdown"]]
    assert totals == sorted(totals, reverse=True)


def test_judge_compare_two_judges(client, patch_analytics_cases):
    data = client.get(
        "/api/v1/analytics/judge-compare?names=Member%20Alpha,Justice%20Gamma"
    ).get_json()
    assert len(data["judges"]) == 2


def test_judge_compare_requires_two_names(client, patch_analytics_cases):
    resp = client.get("/api/v1/analytics/judge-compare?names=Member%20Alpha")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Phase 3: Concept Intelligence
# ---------------------------------------------------------------------------


def test_concept_effectiveness_returns_concepts(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/concept-effectiveness").get_json()
    assert "concepts" in data
    assert data["concepts"]


def test_concept_effectiveness_has_lift(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/concept-effectiveness").get_json()
    assert "lift" in data["concepts"][0]


def test_concept_effectiveness_court_breakdown(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/concept-effectiveness").get_json()
    assert "by_court" in data["concepts"][0]


def test_concept_effectiveness_limit(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/concept-effectiveness?limit=3").get_json()
    assert len(data["concepts"]) <= 3


def test_concept_cooccurrence_returns_matrix(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/concept-cooccurrence?min_count=1").get_json()
    assert "concepts" in data
    assert "matrix" in data


def test_concept_cooccurrence_top_pairs_sorted(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/concept-cooccurrence?min_count=1").get_json()
    counts = [pair["count"] for pair in data["top_pairs"]]
    assert counts == sorted(counts, reverse=True)


def test_concept_cooccurrence_min_count_filter(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/concept-cooccurrence?min_count=999").get_json()
    assert data["top_pairs"] == []


def test_concept_trends_returns_series(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/concept-trends").get_json()
    assert "series" in data


def test_concept_trends_emerging_declining(client, patch_analytics_cases):
    data = client.get("/api/v1/analytics/concept-trends").get_json()
    assert "emerging" in data
    assert "declining" in data
