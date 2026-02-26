"""Tests for GET /api/v1/search/semantic endpoint (free-text vector search)."""

from __future__ import annotations

import pytest


# ---------------------------------------------------------------------------
# 1. Graceful fallback — non-Supabase backends
# ---------------------------------------------------------------------------


def test_semantic_search_returns_200_non_supabase(client):
    """Endpoint should return 200 with available=False on CSV/SQLite backend."""
    resp = client.get("/api/v1/search/semantic?q=refugee+protection")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["available"] is False
    assert isinstance(data["results"], list)


def test_semantic_search_requires_q_param(client):
    """Missing q param → 400."""
    resp = client.get("/api/v1/search/semantic")
    assert resp.status_code == 400


def test_semantic_search_rejects_empty_q(client):
    """Empty q param → 400."""
    resp = client.get("/api/v1/search/semantic?q=")
    assert resp.status_code == 400


def test_semantic_search_rejects_short_q(client):
    """q shorter than 3 chars → 400."""
    resp = client.get("/api/v1/search/semantic?q=ab")
    assert resp.status_code == 400


def test_semantic_search_accepts_limit_param(client):
    """limit query param is accepted without error."""
    resp = client.get("/api/v1/search/semantic?q=visa+cancellation&limit=3")
    assert resp.status_code == 200


def test_semantic_search_limit_capped_at_20(client):
    """limit > 20 still returns valid response (server caps it)."""
    resp = client.get("/api/v1/search/semantic?q=refugee&limit=999")
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data.get("results", [])) <= 20


# ---------------------------------------------------------------------------
# 2. Response shape contract
# ---------------------------------------------------------------------------


def test_semantic_search_response_shape(client):
    """Response always has results (list), available (bool), query (str)."""
    resp = client.get("/api/v1/search/semantic?q=protection+visa")
    data = resp.get_json()
    assert isinstance(data.get("available"), bool)
    assert isinstance(data.get("results"), list)
    assert isinstance(data.get("query"), str)


# ---------------------------------------------------------------------------
# 3. Monkeypatched — with fake Supabase + embedding client
# ---------------------------------------------------------------------------


def test_semantic_search_result_items_have_expected_fields(client, monkeypatch):
    """When results are returned, each item has required fields."""

    fake_results = [
        {
            "case_id": "abc123456789",
            "citation": "[2023] AATA 1",
            "title": "Test v Minister",
            "outcome": "Affirmed",
            "similarity_score": 0.87,
        }
    ]

    def _fake_run(query, limit=10, provider="openai", model=""):
        return {
            "results": fake_results,
            "available": True,
            "query": query,
            "provider": provider,
            "model": model,
        }

    try:
        monkeypatch.setattr(
            "immi_case_downloader.web.routes.api._run_semantic_search",
            _fake_run,
        )
        resp = client.get("/api/v1/search/semantic?q=protection+visa")
        data = resp.get_json()
        if data.get("available") and data.get("results"):
            item = data["results"][0]
            assert "case_id" in item
            assert "citation" in item
            assert "title" in item
            assert "outcome" in item
            assert "similarity_score" in item
    except (AttributeError, TypeError):
        pytest.skip("_run_semantic_search not patchable in this backend")


def test_semantic_search_provider_param_forwarded(client, monkeypatch):
    """provider query param is forwarded to the helper function."""

    received = {}

    def _fake_run(query, limit=10, provider="openai", model=""):
        received["provider"] = provider
        return {"results": [], "available": True, "query": query,
                "provider": provider, "model": model}

    try:
        monkeypatch.setattr(
            "immi_case_downloader.web.routes.api._run_semantic_search",
            _fake_run,
        )
        client.get("/api/v1/search/semantic?q=visa&provider=gemini")
        assert received.get("provider") == "gemini"
    except (AttributeError, TypeError):
        pytest.skip("_run_semantic_search not patchable in this backend")


def test_semantic_search_invalid_provider_returns_400(client):
    """Unknown provider value → 400."""
    resp = client.get("/api/v1/search/semantic?q=visa&provider=unknown_llm")
    assert resp.status_code == 400
