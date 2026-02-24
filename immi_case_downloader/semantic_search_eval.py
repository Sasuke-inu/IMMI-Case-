"""Semantic search evaluation utilities.

This module supports a reproducible 1,000-case experiment that compares:
1) lexical retrieval (SQLite FTS5),
2) semantic retrieval (OpenAI embeddings + cosine similarity),
3) hybrid retrieval (RRF fusion).

It is designed for maintainable, repeatable benchmarking rather than
production serving. Production integration should use database-side indexes
(e.g., PostgreSQL FTS + pgvector).
"""

from __future__ import annotations

import json
import math
import os
import random
import re
import sqlite3
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import numpy as np
import requests
from dotenv import load_dotenv

from .legal_concepts_registry import LEGAL_CONCEPTS
from .supabase_repository import SupabaseRepository

EVAL_TABLE = "immigration_cases"
OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings"
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
_TOKEN_RE = re.compile(r"[a-z0-9]{2,}")


@dataclass(frozen=True)
class EvalCase:
    """Minimal case payload used for evaluation."""

    case_id: str
    title: str
    citation: str
    catchwords: str
    visa_type: str
    legislation: str
    outcome: str
    text_snippet: str
    legal_concepts: str
    case_nature: str
    full_text_path: str

    def summary_text(self) -> str:
        """Text used for document embedding in the experiment."""
        return " | ".join(
            part.strip()
            for part in [
                self.title,
                self.citation,
                self.catchwords,
                self.visa_type,
                self.legislation,
                self.case_nature,
                self.legal_concepts,
                self.outcome,
                self.text_snippet,
            ]
            if part and part.strip()
        )


@dataclass(frozen=True)
class EvalQuery:
    """Evaluation query with silver relevance labels."""

    case_id: str
    text: str
    relevant_case_ids: frozenset[str]
    primary_concept: str


@dataclass(frozen=True)
class EmbeddingCostEstimate:
    """Embedding token/cost estimate bundle."""

    sample_summary_tokens: int
    sample_query_tokens: int
    sample_full_text_tokens: int
    sample_summary_cost_usd: float
    sample_query_cost_usd: float
    sample_total_cost_usd: float
    projected_summary_ingest_cost_usd: float
    projected_full_text_ingest_cost_usd: float
    estimated_query_cost_usd: float


def normalize_for_match(value: str) -> str:
    """Normalize text for fuzzy concept matching."""
    return " ".join(_TOKEN_RE.findall((value or "").lower()))


def split_concepts(raw: str) -> list[str]:
    """Split legal concept string into unique ordered values.

    Source data may use ';', ',', or '|'.
    """
    if not raw:
        return []
    parts = re.split(r"[;,|]", raw)
    seen: set[str] = set()
    out: list[str] = []
    for part in parts:
        cleaned = part.strip()
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(cleaned)
    return out


def tokenize(text: str) -> list[str]:
    """Tokenize text for lexical retrieval/query building."""
    return _TOKEN_RE.findall((text or "").lower())


def estimate_tokens(text: str) -> int:
    """Heuristic token estimate (~4 chars/token)."""
    stripped = (text or "").strip()
    if not stripped:
        return 0
    return max(1, math.ceil(len(stripped) / 4))


def _build_keyword_registry() -> list[tuple[str, list[str]]]:
    registry: list[tuple[str, list[str]]] = []
    for concept in LEGAL_CONCEPTS:
        name = normalize_for_match(concept["name"])
        keywords = [
            kw.strip()
            for kw in concept.get("keywords", [])
            if isinstance(kw, str) and kw.strip()
        ]
        if name and keywords:
            registry.append((name, keywords))
    return registry


_KEYWORD_REGISTRY = _build_keyword_registry()


def concept_to_synonym(concept: str) -> str:
    """Map a concept label to a related keyword phrase when available."""
    concept_norm = normalize_for_match(concept)
    if not concept_norm:
        return ""
    for name_norm, keywords in _KEYWORD_REGISTRY:
        if concept_norm in name_norm or name_norm in concept_norm:
            for kw in keywords:
                if normalize_for_match(kw) != concept_norm:
                    return kw
            return keywords[0]
    return concept


def build_query_text(case: EvalCase, primary_concept: str) -> str:
    """Generate a natural-language query for retrieval evaluation."""
    concept_term = concept_to_synonym(primary_concept)
    nature = case.case_nature.strip() or "immigration review"
    outcome = case.outcome.strip()
    parts = [
        "Find Australian immigration decisions about",
        concept_term or nature,
        "with issues related to",
        nature.lower(),
    ]
    if outcome:
        parts.extend(["and likely outcome", outcome.lower()])
    return " ".join(parts).strip()


def build_relevance_sets(cases: list[EvalCase]) -> dict[str, set[str]]:
    """Create silver relevance labels from concept and case nature overlap."""
    by_concept: dict[str, set[str]] = {}
    by_nature: dict[str, set[str]] = {}
    concepts_by_case: dict[str, list[str]] = {}

    for case in cases:
        concepts = split_concepts(case.legal_concepts)
        concepts_by_case[case.case_id] = concepts
        for concept in concepts:
            key = normalize_for_match(concept)
            if not key:
                continue
            by_concept.setdefault(key, set()).add(case.case_id)

        nature_key = normalize_for_match(case.case_nature)
        if nature_key:
            by_nature.setdefault(nature_key, set()).add(case.case_id)

    relevance: dict[str, set[str]] = {}
    for case in cases:
        rel: set[str] = set()
        for concept in concepts_by_case[case.case_id]:
            key = normalize_for_match(concept)
            if key and key in by_concept:
                rel.update(by_concept[key])

        nature_key = normalize_for_match(case.case_nature)
        if nature_key and nature_key in by_nature:
            rel.update(by_nature[nature_key])

        rel.discard(case.case_id)
        relevance[case.case_id] = rel
    return relevance


def build_eval_queries(cases: list[EvalCase], min_relevant: int = 3) -> list[EvalQuery]:
    """Build query set using per-case concepts/nature and silver labels."""
    relevance = build_relevance_sets(cases)
    queries: list[EvalQuery] = []
    for case in cases:
        concepts = split_concepts(case.legal_concepts)
        primary = concepts[0] if concepts else (case.case_nature or "migration law")
        rel = relevance.get(case.case_id, set())
        if len(rel) < min_relevant:
            continue
        q = EvalQuery(
            case_id=case.case_id,
            text=build_query_text(case, primary),
            relevant_case_ids=frozenset(rel),
            primary_concept=primary,
        )
        queries.append(q)
    return queries


class SqliteLexicalRetriever:
    """Small lexical retriever backed by in-memory SQLite FTS5."""

    def __init__(self, cases: list[EvalCase]):
        self._conn = sqlite3.connect(":memory:")
        self._conn.execute(
            "CREATE VIRTUAL TABLE docs_fts USING fts5("
            "case_id UNINDEXED, content, tokenize='porter'"
            ")"
        )
        rows = [(case.case_id, case.summary_text()) for case in cases]
        self._conn.executemany(
            "INSERT INTO docs_fts(case_id, content) VALUES(?, ?)",
            rows,
        )
        self._conn.commit()

    def search(self, query: str, limit: int = 50, exclude_case_id: str = "") -> list[str]:
        tokens = tokenize(query)
        if not tokens:
            return []
        # OR query is less brittle than strict AND for generated queries.
        fts_query = " OR ".join(tokens[:16])
        rows = self._conn.execute(
            "SELECT case_id, bm25(docs_fts) as score "
            "FROM docs_fts "
            "WHERE docs_fts MATCH ? "
            "ORDER BY score ASC "
            "LIMIT ?",
            (fts_query, max(limit * 2, 20)),
        ).fetchall()

        ranked: list[str] = []
        for case_id, _ in rows:
            if exclude_case_id and case_id == exclude_case_id:
                continue
            ranked.append(case_id)
            if len(ranked) >= limit:
                break
        return ranked


class OpenAIEmbeddingClient:
    """Thin client for OpenAI embeddings API with retry support."""

    def __init__(
        self,
        api_key: str,
        model: str,
        timeout_seconds: int = 60,
        max_retries: int = 4,
    ):
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries

    def embed_texts(
        self,
        texts: list[str],
        batch_size: int = 128,
        task_type: str | None = None,
    ) -> np.ndarray:
        if not texts:
            return np.zeros((0, 0), dtype=np.float32)

        vectors: list[list[float]] = []
        for start in range(0, len(texts), batch_size):
            chunk = texts[start:start + batch_size]
            vectors.extend(self._embed_chunk(chunk))
        return np.asarray(vectors, dtype=np.float32)

    def _embed_chunk(self, chunk: list[str]) -> list[list[float]]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "input": chunk,
        }

        last_error = "unknown"
        for attempt in range(self.max_retries):
            try:
                response = requests.post(
                    OPENAI_EMBEDDINGS_URL,
                    headers=headers,
                    json=payload,
                    timeout=self.timeout_seconds,
                )
                if response.status_code == 429:
                    time.sleep(1.5 * (attempt + 1))
                    continue
                if response.status_code >= 500:
                    time.sleep(1.0 * (attempt + 1))
                    continue
                response.raise_for_status()
                body = response.json()
                data = sorted(body["data"], key=lambda x: x["index"])
                return [row["embedding"] for row in data]
            except Exception as exc:  # pragma: no cover - network failures are environment-dependent
                last_error = str(exc)
                if attempt < self.max_retries - 1:
                    time.sleep(1.0 * (attempt + 1))
                    continue
        raise RuntimeError(f"Embedding API failed after retries: {last_error}")


class GeminiEmbeddingClient:
    """Gemini embeddings client via batchEmbedContents REST endpoint."""

    def __init__(
        self,
        api_key: str,
        model: str = "models/gemini-embedding-001",
        timeout_seconds: int = 60,
        max_retries: int = 4,
    ):
        self.api_key = api_key
        self.model = model if model.startswith("models/") else f"models/{model}"
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries

    def embed_texts(
        self,
        texts: list[str],
        batch_size: int = 64,
        task_type: str | None = "RETRIEVAL_DOCUMENT",
    ) -> np.ndarray:
        if not texts:
            return np.zeros((0, 0), dtype=np.float32)

        vectors: list[list[float]] = []
        for start in range(0, len(texts), batch_size):
            chunk = texts[start:start + batch_size]
            vectors.extend(self._embed_chunk(chunk, task_type=task_type))
        return np.asarray(vectors, dtype=np.float32)

    def _embed_chunk(self, chunk: list[str], task_type: str | None) -> list[list[float]]:
        url = (
            f"{GEMINI_API_BASE}/{self.model}:batchEmbedContents"
            f"?key={self.api_key}"
        )
        requests_body = []
        for text in chunk:
            payload = {
                "model": self.model,
                "content": {"parts": [{"text": text}]},
            }
            if task_type:
                payload["taskType"] = task_type
            requests_body.append(payload)
        body = {"requests": requests_body}

        last_error = "unknown"
        for attempt in range(self.max_retries):
            try:
                response = requests.post(
                    url,
                    json=body,
                    timeout=self.timeout_seconds,
                )
                if response.status_code == 429:
                    time.sleep(1.5 * (attempt + 1))
                    continue
                if response.status_code >= 500:
                    time.sleep(1.0 * (attempt + 1))
                    continue
                response.raise_for_status()
                data = response.json().get("embeddings", [])
                return [row.get("values", []) for row in data]
            except Exception as exc:  # pragma: no cover - network failures are environment-dependent
                last_error = str(exc)
                if attempt < self.max_retries - 1:
                    time.sleep(1.0 * (attempt + 1))
                    continue
        raise RuntimeError(f"Gemini embedding API failed after retries: {last_error}")


def _normalize_rows(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms = np.where(norms == 0.0, 1.0, norms)
    return vectors / norms


def rank_semantic(
    cases: list[EvalCase],
    queries: list[EvalQuery],
    embedding_client,
    limit: int,
) -> dict[str, list[str]]:
    """Rank with cosine similarity over summary embeddings."""
    doc_texts = [case.summary_text() for case in cases]
    query_texts = [q.text for q in queries]

    doc_vectors = _normalize_rows(
        embedding_client.embed_texts(
            doc_texts,
            task_type="RETRIEVAL_DOCUMENT",
        )
    )
    query_vectors = _normalize_rows(
        embedding_client.embed_texts(
            query_texts,
            task_type="RETRIEVAL_QUERY",
        )
    )

    scores = query_vectors @ doc_vectors.T
    case_ids = [case.case_id for case in cases]
    case_id_to_idx = {case.case_id: idx for idx, case in enumerate(cases)}

    rankings: dict[str, list[str]] = {}
    for q_idx, query in enumerate(queries):
        row = scores[q_idx]
        order = np.argsort(-row)
        ranked_ids: list[str] = []
        for idx in order:
            candidate_id = case_ids[int(idx)]
            if candidate_id == query.case_id:
                continue
            ranked_ids.append(candidate_id)
            if len(ranked_ids) >= limit:
                break

        # Safety fallback for edge cases where query case ID was not present.
        if query.case_id not in case_id_to_idx and len(ranked_ids) < limit:
            for candidate_id in case_ids:
                if candidate_id not in ranked_ids:
                    ranked_ids.append(candidate_id)
                if len(ranked_ids) >= limit:
                    break

        rankings[query.case_id] = ranked_ids
    return rankings


def rank_lexical(
    cases: list[EvalCase],
    queries: list[EvalQuery],
    limit: int,
) -> dict[str, list[str]]:
    retriever = SqliteLexicalRetriever(cases)
    rankings: dict[str, list[str]] = {}
    for query in queries:
        rankings[query.case_id] = retriever.search(
            query=query.text,
            limit=limit,
            exclude_case_id=query.case_id,
        )
    return rankings


def reciprocal_rank_fusion(
    ranked_lists: list[list[str]],
    k: int = 60,
    weights: list[float] | None = None,
    limit: int = 50,
) -> list[str]:
    """Reciprocal Rank Fusion over ranked document ID lists."""
    if not ranked_lists:
        return []
    if weights is None:
        weights = [1.0] * len(ranked_lists)
    if len(weights) != len(ranked_lists):
        raise ValueError("weights length must match ranked_lists length")

    scores: dict[str, float] = {}
    for ranked, weight in zip(ranked_lists, weights):
        for rank, doc_id in enumerate(ranked):
            scores[doc_id] = scores.get(doc_id, 0.0) + weight * (1.0 / (k + rank + 1))
    return [
        doc_id
        for doc_id, _ in sorted(scores.items(), key=lambda item: item[1], reverse=True)[:limit]
    ]


def rank_hybrid(
    lexical_rankings: dict[str, list[str]],
    semantic_rankings: dict[str, list[str]],
    limit: int,
    semantic_weight: float = 0.5,
) -> dict[str, list[str]]:
    rankings: dict[str, list[str]] = {}
    for case_id, sem_ranked in semantic_rankings.items():
        lex_ranked = lexical_rankings.get(case_id, [])
        rankings[case_id] = reciprocal_rank_fusion(
            ranked_lists=[sem_ranked, lex_ranked],
            k=60,
            weights=[semantic_weight, 1.0 - semantic_weight],
            limit=limit,
        )
    return rankings


def _dcg_at_k(ranked_ids: list[str], relevant: set[str], k: int) -> float:
    score = 0.0
    for idx, doc_id in enumerate(ranked_ids[:k]):
        if doc_id in relevant:
            score += 1.0 / math.log2(idx + 2)
    return score


def evaluate_rankings(
    queries: list[EvalQuery],
    rankings: dict[str, list[str]],
    k_values: Iterable[int],
) -> dict[str, float]:
    """Compute average retrieval metrics over all queries."""
    k_values = sorted(set(int(k) for k in k_values if int(k) > 0))
    if not k_values:
        raise ValueError("k_values must contain at least one positive integer")

    max_k = max(k_values)
    n = len(queries)
    if n == 0:
        base = {"query_count": 0.0}
        for k in k_values:
            base[f"recall@{k}"] = 0.0
            base[f"precision@{k}"] = 0.0
            base[f"ndcg@{k}"] = 0.0
        base[f"mrr@{max_k}"] = 0.0
        return base

    totals: dict[str, float] = {"query_count": float(n)}
    for k in k_values:
        totals[f"recall@{k}"] = 0.0
        totals[f"precision@{k}"] = 0.0
        totals[f"ndcg@{k}"] = 0.0
    totals[f"mrr@{max_k}"] = 0.0

    for query in queries:
        rel = set(query.relevant_case_ids)
        ranked = rankings.get(query.case_id, [])
        if not rel:
            continue

        # MRR
        rr = 0.0
        for idx, doc_id in enumerate(ranked[:max_k]):
            if doc_id in rel:
                rr = 1.0 / (idx + 1)
                break
        totals[f"mrr@{max_k}"] += rr

        # Recall / Precision / nDCG
        for k in k_values:
            top_k = ranked[:k]
            hits = sum(1 for doc_id in top_k if doc_id in rel)
            totals[f"recall@{k}"] += hits / len(rel)
            totals[f"precision@{k}"] += hits / k
            ideal = min(len(rel), k)
            if ideal == 0:
                continue
            idcg = sum(1.0 / math.log2(i + 2) for i in range(ideal))
            dcg = _dcg_at_k(ranked, rel, k)
            totals[f"ndcg@{k}"] += (dcg / idcg) if idcg else 0.0

    for key in list(totals.keys()):
        if key == "query_count":
            continue
        totals[key] = totals[key] / n
    return totals


def _read_text_file(path: str) -> str:
    p = Path(path)
    if not p.exists() or not p.is_file():
        return ""
    try:
        return p.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def estimate_embedding_costs(
    cases: list[EvalCase],
    queries: list[EvalQuery],
    total_case_count: int,
    price_per_1m_tokens: float,
) -> EmbeddingCostEstimate:
    """Estimate embedding cost for sample and full-corpus rollout."""
    summary_tokens = sum(estimate_tokens(case.summary_text()) for case in cases)
    query_tokens = sum(estimate_tokens(query.text) for query in queries)
    full_text_tokens = sum(
        estimate_tokens(_read_text_file(case.full_text_path))
        for case in cases
    )

    sample_summary_cost = (summary_tokens / 1_000_000) * price_per_1m_tokens
    sample_query_cost = (query_tokens / 1_000_000) * price_per_1m_tokens
    sample_total_cost = sample_summary_cost + sample_query_cost

    avg_summary_tokens = (summary_tokens / len(cases)) if cases else 0.0
    avg_full_tokens = (full_text_tokens / len(cases)) if cases else 0.0
    avg_query_tokens = (query_tokens / len(queries)) if queries else 0.0

    projected_summary_ingest_cost = (
        (avg_summary_tokens * total_case_count) / 1_000_000
    ) * price_per_1m_tokens
    projected_full_text_ingest_cost = (
        (avg_full_tokens * total_case_count) / 1_000_000
    ) * price_per_1m_tokens
    projected_query_cost = (avg_query_tokens / 1_000_000) * price_per_1m_tokens

    return EmbeddingCostEstimate(
        sample_summary_tokens=int(summary_tokens),
        sample_query_tokens=int(query_tokens),
        sample_full_text_tokens=int(full_text_tokens),
        sample_summary_cost_usd=sample_summary_cost,
        sample_query_cost_usd=sample_query_cost,
        sample_total_cost_usd=sample_total_cost,
        projected_summary_ingest_cost_usd=projected_summary_ingest_cost,
        projected_full_text_ingest_cost_usd=projected_full_text_ingest_cost,
        estimated_query_cost_usd=projected_query_cost,
    )


def sample_cases_from_supabase(
    sample_size: int,
    seed: int,
    pool_size: int | None = None,
) -> tuple[list[EvalCase], int]:
    """Sample cases from Supabase without scanning the entire table."""
    load_dotenv()
    repo = SupabaseRepository()
    total = int(repo.get_statistics().get("total") or 0)
    if total <= 0:
        raise RuntimeError("Supabase returned zero rows for immigration_cases")

    target_pool = pool_size or max(sample_size * 5, 5000)
    target_pool = min(target_pool, total)
    rng = random.Random(seed)
    start = rng.randint(0, max(0, total - target_pool))

    columns = ",".join(
        [
            "case_id",
            "title",
            "citation",
            "catchwords",
            "visa_type",
            "legislation",
            "outcome",
            "text_snippet",
            "legal_concepts",
            "case_nature",
            "full_text_path",
        ]
    )

    rows: list[dict] = []
    chunk_size = 1000
    fetched = 0
    while fetched < target_pool:
        chunk = min(chunk_size, target_pool - fetched)
        lo = start + fetched
        hi = lo + chunk - 1
        response = (
            repo._client.table(EVAL_TABLE)
            .select(columns)
            .range(lo, hi)
            .execute()
        )
        data = response.data or []
        if not data:
            break
        rows.extend(data)
        fetched += len(data)
        if len(data) < chunk:
            break

    if len(rows) < sample_size:
        raise RuntimeError(
            f"Not enough rows sampled from Supabase: requested={sample_size}, got={len(rows)}"
        )

    sampled_rows = rng.sample(rows, sample_size)
    cases = [
        EvalCase(
            case_id=str(row.get("case_id", "")),
            title=str(row.get("title", "")),
            citation=str(row.get("citation", "")),
            catchwords=str(row.get("catchwords", "")),
            visa_type=str(row.get("visa_type", "")),
            legislation=str(row.get("legislation", "")),
            outcome=str(row.get("outcome", "")),
            text_snippet=str(row.get("text_snippet", "")),
            legal_concepts=str(row.get("legal_concepts", "")),
            case_nature=str(row.get("case_nature", "")),
            full_text_path=str(row.get("full_text_path", "")),
        )
        for row in sampled_rows
        if str(row.get("case_id", "")).strip()
    ]
    return cases, total


def run_semantic_evaluation(
    sample_size: int,
    seed: int,
    provider: str,
    model: str,
    price_per_1m_tokens: float,
    k_values: Iterable[int],
    ranking_limit: int = 50,
) -> dict:
    """Run full lexical vs semantic vs hybrid evaluation."""
    start_ts = time.perf_counter()
    cases, total_case_count = sample_cases_from_supabase(
        sample_size=sample_size,
        seed=seed,
    )
    queries = build_eval_queries(cases)
    if not queries:
        raise RuntimeError("No valid queries generated; check sampled data")

    k_values = sorted(set(int(k) for k in k_values if int(k) > 0))
    if not k_values:
        raise ValueError("k_values must contain positive integers")

    lexical = rank_lexical(cases=cases, queries=queries, limit=ranking_limit)

    # Keys can come from shell or .env (load_dotenv already called by sampler).
    provider_key = provider.lower().strip()
    if provider_key == "openai":
        api_key = os.environ.get("OPENAI_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is required for provider=openai")
        embedding_client = OpenAIEmbeddingClient(api_key=api_key, model=model)
    elif provider_key == "gemini":
        api_key = (
            os.environ.get("GEMINI_API_KEY", "").strip()
            or os.environ.get("GOOGLE_API_KEY", "").strip()
        )
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY or GOOGLE_API_KEY is required for provider=gemini"
            )
        embedding_client = GeminiEmbeddingClient(api_key=api_key, model=model)
    else:
        raise ValueError("provider must be 'openai' or 'gemini'")

    semantic = rank_semantic(
        cases=cases,
        queries=queries,
        embedding_client=embedding_client,
        limit=ranking_limit,
    )
    hybrid = rank_hybrid(
        lexical_rankings=lexical,
        semantic_rankings=semantic,
        limit=ranking_limit,
        semantic_weight=0.5,
    )

    lexical_metrics = evaluate_rankings(queries=queries, rankings=lexical, k_values=k_values)
    semantic_metrics = evaluate_rankings(queries=queries, rankings=semantic, k_values=k_values)
    hybrid_metrics = evaluate_rankings(queries=queries, rankings=hybrid, k_values=k_values)

    costs = estimate_embedding_costs(
        cases=cases,
        queries=queries,
        total_case_count=total_case_count,
        price_per_1m_tokens=price_per_1m_tokens,
    )

    elapsed = time.perf_counter() - start_ts
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "config": {
            "sample_size": sample_size,
            "seed": seed,
            "provider": provider_key,
            "model": model,
            "price_per_1m_tokens": price_per_1m_tokens,
            "k_values": k_values,
            "ranking_limit": ranking_limit,
        },
        "dataset": {
            "total_cases": total_case_count,
            "sampled_cases": len(cases),
            "evaluated_queries": len(queries),
            "notes": (
                "Silver labels: documents are considered relevant when they share "
                "legal concepts and/or case nature with the query case."
            ),
        },
        "results": {
            "lexical_fts5": lexical_metrics,
            "semantic_embeddings": semantic_metrics,
            "hybrid_rrf": hybrid_metrics,
        },
        "costs": costs.__dict__,
        "runtime_seconds": elapsed,
    }


def format_markdown_report(result: dict) -> str:
    """Render evaluation result JSON to concise markdown report."""
    cfg = result["config"]
    dataset = result["dataset"]
    costs = result["costs"]
    lexical = result["results"]["lexical_fts5"]
    semantic = result["results"]["semantic_embeddings"]
    hybrid = result["results"]["hybrid_rrf"]
    k_values = cfg["k_values"]
    max_k = max(k_values)

    def metric_row(name: str, metric: dict) -> str:
        parts = [f"| {name} "]
        for k in k_values:
            parts.append(f"| {metric[f'recall@{k}']:.4f} ")
        for k in k_values:
            parts.append(f"| {metric[f'ndcg@{k}']:.4f} ")
        parts.append(f"| {metric[f'mrr@{max_k}']:.4f} |")
        return "".join(parts)

    header_1 = "".join(
        ["| 方法 "] +
        [f"| Recall@{k} " for k in k_values] +
        [f"| nDCG@{k} " for k in k_values] +
        [f"| MRR@{max_k} |"]
    )
    header_2 = "".join(["| --- "] + ["| --- " for _ in range(len(k_values) * 2 + 1)] + ["|"])

    lines = [
        "# 語義搜尋 1000 筆評估報告",
        "",
        "## 實驗設定",
        f"- 產生時間（UTC）: `{result['generated_at']}`",
        f"- 抽樣筆數: `{cfg['sample_size']}`",
        f"- 評估查詢數: `{dataset['evaluated_queries']}`",
        f"- 總資料筆數（Supabase）: `{dataset['total_cases']}`",
        f"- Embedding 模型: `{cfg['model']}`",
        f"- 單價假設: `${cfg['price_per_1m_tokens']}` / 1M tokens",
        "",
        "## 準確度比較",
        header_1,
        header_2,
        metric_row("Lexical (SQLite FTS5)", lexical),
        metric_row("Semantic (Embeddings)", semantic),
        metric_row("Hybrid (RRF)", hybrid),
        "",
        "## 成本估算（Embedding）",
        f"- 1000 筆摘要向量 tokens: `{costs['sample_summary_tokens']:,}`",
        f"- 1000 筆查詢向量 tokens: `{costs['sample_query_tokens']:,}`",
        f"- 1000 筆摘要+查詢成本: `${costs['sample_total_cost_usd']:.4f}`",
        f"- 全量摘要一次性嵌入成本（{dataset['total_cases']:,} 筆）: "
        f"`${costs['projected_summary_ingest_cost_usd']:.2f}`",
        f"- 全量全文一次性嵌入成本（估算）: "
        f"`${costs['projected_full_text_ingest_cost_usd']:.2f}`",
        f"- 單次查詢向量成本（估算）: `${costs['estimated_query_cost_usd']:.6f}` / query",
        "",
        "## 注意事項",
        f"- {dataset['notes']}",
        "- 此評估反映方法相對表現，非人工黃金標註最終準確率。",
    ]
    return "\n".join(lines)


def write_report_files(result: dict, output_dir: str | Path) -> tuple[Path, Path]:
    """Write JSON + Markdown reports to output directory."""
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = out / f"semantic_eval_{stamp}.json"
    md_path = out / f"semantic_eval_{stamp}.md"

    json_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    md_path.write_text(format_markdown_report(result), encoding="utf-8")
    return json_path, md_path
