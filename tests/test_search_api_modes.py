"""Tests for /api/v1/search mode handling (lexical/semantic/hybrid)."""

from __future__ import annotations

import immi_case_downloader.web.routes.api_cases as api_cases_module


def test_search_default_mode_is_lexical(client):
    resp = client.get("/api/v1/search?q=Applicant&limit=2")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["mode"] == "lexical"
    assert isinstance(data["cases"], list)
    assert len(data["cases"]) <= 2


def test_search_rejects_invalid_mode(client):
    resp = client.get("/api/v1/search?q=Applicant&mode=unknown")
    assert resp.status_code == 400
    data = resp.get_json()
    assert "mode must be one of" in data["error"]


def test_search_rejects_invalid_provider(client):
    resp = client.get("/api/v1/search?q=Applicant&mode=semantic&provider=invalid")
    assert resp.status_code == 400
    data = resp.get_json()
    assert "provider must be one of" in data["error"]


def test_search_semantic_returns_400_without_required_api_key(client, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    resp = client.get("/api/v1/search?q=Applicant&mode=semantic&provider=openai")
    assert resp.status_code == 400
    data = resp.get_json()
    assert "OPENAI_API_KEY is required" in data["error"]


def test_search_hybrid_falls_back_when_api_key_is_missing(client, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    resp = client.get("/api/v1/search?q=Applicant&mode=hybrid&provider=openai&limit=3")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["mode"] == "lexical_fallback"
    assert "warning" in data
    assert len(data["cases"]) <= 3


def test_search_hybrid_falls_back_to_lexical_when_rerank_fails(client, monkeypatch):
    def _raise_runtime_error(*_args, **_kwargs):
        raise RuntimeError("simulated embedding failure")

    monkeypatch.setattr(api_cases_module, "_semantic_rerank_cases", _raise_runtime_error)
    resp = client.get("/api/v1/search?q=Applicant&mode=hybrid&limit=3")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["mode"] == "lexical_fallback"
    assert "warning" in data
    assert len(data["cases"]) <= 3


def test_search_semantic_uses_reranked_results_when_available(client, monkeypatch):
    def _fake_rerank(query, candidates, mode, limit, provider, model):
        assert query
        assert mode == "semantic"
        assert provider in {"openai", "gemini"}
        return list(reversed(candidates))[:limit], "openai", "test-embedding-model"

    monkeypatch.setattr(api_cases_module, "_semantic_rerank_cases", _fake_rerank)
    resp = client.get("/api/v1/search?q=Applicant&mode=semantic&limit=2")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["mode"] == "semantic"
    assert data["provider"] == "openai"
    assert data["model"] == "test-embedding-model"
    assert len(data["cases"]) <= 2
