#!/usr/bin/env python3
"""Two-stage embedding backfill pipeline.

Stage 1 (generate):
  - Read cases from Supabase
  - Build embedding text
  - Generate embeddings via provider API
  - Store embeddings into local SQLite staging DB (no Supabase write)

Stage 2 (apply):
  - Read unapplied staged embeddings from local SQLite
  - Upsert to Supabase in small batches with retry
  - Mark staged rows as applied

This design prevents repeated embedding API charges when Supabase writes fail.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from dotenv import load_dotenv
from postgrest.exceptions import APIError

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from immi_case_downloader.semantic_search_eval import (  # noqa: E402
    GeminiEmbeddingClient,
    OpenAIEmbeddingClient,
    estimate_tokens,
)
from immi_case_downloader.supabase_repository import SupabaseRepository  # noqa: E402

TABLE = "immigration_cases"
MAX_PAGE_SIZE = 1000
DEFAULT_STAGE_DB = PROJECT_ROOT / "downloaded_cases" / "embedding_stage.sqlite3"
DEFAULT_GENERATE_CKPT = PROJECT_ROOT / "downloaded_cases" / "embedding_generate_checkpoint.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_embedding_text(row: dict) -> str:
    return " | ".join(
        part.strip()
        for part in [
            str(row.get("title", "") or ""),
            str(row.get("citation", "") or ""),
            str(row.get("catchwords", "") or ""),
            str(row.get("visa_type", "") or ""),
            str(row.get("legislation", "") or ""),
            str(row.get("case_nature", "") or ""),
            str(row.get("legal_concepts", "") or ""),
            str(row.get("outcome", "") or ""),
            str(row.get("text_snippet", "") or ""),
        ]
        if part and part.strip()
    )


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def vector_to_literal(vector: Iterable[float]) -> str:
    return "[" + ",".join(f"{float(v):.9f}" for v in vector) + "]"


def make_embedding_client(provider: str, model: str):
    provider = provider.lower().strip()
    if provider == "openai":
        key = os.environ.get("OPENAI_API_KEY", "").strip()
        if not key:
            raise RuntimeError("OPENAI_API_KEY is required for provider=openai")
        return OpenAIEmbeddingClient(api_key=key, model=model)
    if provider == "gemini":
        key = (
            os.environ.get("GEMINI_API_KEY", "").strip()
            or os.environ.get("GOOGLE_API_KEY", "").strip()
        )
        if not key:
            raise RuntimeError("GEMINI_API_KEY or GOOGLE_API_KEY is required for provider=gemini")
        return GeminiEmbeddingClient(api_key=key, model=model)
    raise RuntimeError("provider must be one of: openai, gemini")


def load_checkpoint(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_checkpoint(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def should_reembed(
    row: dict,
    *,
    provider: str,
    model: str,
    content_hash: str,
    force: bool,
) -> bool:
    if force:
        return True

    existing_hash = str(row.get("embedding_content_hash", "") or "")
    existing_provider = str(row.get("embedding_provider", "") or "")
    existing_model = str(row.get("embedding_model", "") or "")
    existing_dims = int(row.get("embedding_dimensions") or 0)
    has_embedding = bool(row.get("embedding"))

    if not has_embedding:
        return True
    if existing_hash != content_hash:
        return True
    if existing_provider != provider or existing_model != model:
        return True
    if existing_dims <= 0:
        return True
    return False


def open_stage_db(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS staged_embeddings (
            case_id TEXT PRIMARY KEY,
            provider TEXT NOT NULL,
            model TEXT NOT NULL,
            dimensions INTEGER NOT NULL,
            content_hash TEXT NOT NULL,
            embedding_literal TEXT NOT NULL,
            generated_at TEXT NOT NULL,
            applied_at TEXT,
            apply_error TEXT
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_staged_embeddings_applied_at "
        "ON staged_embeddings(applied_at)"
    )
    conn.commit()
    return conn


def stage_upsert(conn: sqlite3.Connection, rows: list[dict]) -> None:
    if not rows:
        return
    conn.executemany(
        """
        INSERT INTO staged_embeddings(
            case_id, provider, model, dimensions, content_hash,
            embedding_literal, generated_at, applied_at, apply_error
        ) VALUES(?, ?, ?, ?, ?, ?, ?, NULL, NULL)
        ON CONFLICT(case_id) DO UPDATE SET
            provider=excluded.provider,
            model=excluded.model,
            dimensions=excluded.dimensions,
            content_hash=excluded.content_hash,
            embedding_literal=excluded.embedding_literal,
            generated_at=excluded.generated_at,
            applied_at=NULL,
            apply_error=NULL
        """,
        [
            (
                r["case_id"],
                r["provider"],
                r["model"],
                r["dimensions"],
                r["content_hash"],
                r["embedding_literal"],
                r["generated_at"],
            )
            for r in rows
        ],
    )
    conn.commit()


def fetch_stage_batch(conn: sqlite3.Connection, limit: int) -> list[dict]:
    cur = conn.execute(
        """
        SELECT case_id, provider, model, dimensions, content_hash, embedding_literal
        FROM staged_embeddings
        WHERE applied_at IS NULL
        ORDER BY generated_at ASC
        LIMIT ?
        """,
        (limit,),
    )
    out = []
    for row in cur.fetchall():
        out.append(
            {
                "case_id": row[0],
                "provider": row[1],
                "model": row[2],
                "dimensions": int(row[3]),
                "content_hash": row[4],
                "embedding_literal": row[5],
            }
        )
    return out


def mark_applied(conn: sqlite3.Connection, case_ids: list[str]) -> None:
    if not case_ids:
        return
    conn.executemany(
        "UPDATE staged_embeddings SET applied_at = ?, apply_error = NULL WHERE case_id = ?",
        [(now_iso(), case_id) for case_id in case_ids],
    )
    conn.commit()


def mark_apply_error(conn: sqlite3.Connection, case_ids: list[str], error: str) -> None:
    if not case_ids:
        return
    conn.executemany(
        "UPDATE staged_embeddings SET apply_error = ? WHERE case_id = ?",
        [(error[:1000], case_id) for case_id in case_ids],
    )
    conn.commit()


def count_stage_rows(conn: sqlite3.Connection) -> tuple[int, int]:
    total = int(conn.execute("SELECT COUNT(*) FROM staged_embeddings").fetchone()[0])
    pending = int(
        conn.execute("SELECT COUNT(*) FROM staged_embeddings WHERE applied_at IS NULL").fetchone()[0]
    )
    return total, pending


def fetch_rows(repo: SupabaseRepository, offset: int, page_size: int) -> list[dict]:
    cols = ",".join(
        [
            "case_id",
            "title",
            "citation",
            "catchwords",
            "visa_type",
            "legislation",
            "case_nature",
            "legal_concepts",
            "outcome",
            "text_snippet",
            "embedding",
            "embedding_provider",
            "embedding_model",
            "embedding_dimensions",
            "embedding_content_hash",
        ]
    )
    for attempt in range(4):
        try:
            resp = (
                repo._client.table(TABLE)
                .select(cols)
                .range(offset, offset + page_size - 1)
                .execute()
            )
            return resp.data or []
        except Exception as exc:
            if attempt < 3:
                wait = 2 ** attempt
                print(f"  WARN fetch_rows offset={offset} attempt {attempt+1} failed: {exc}; retry in {wait}s")
                time.sleep(wait)
            else:
                raise
    return []


def fetch_rows_needing_embedding(
    repo: SupabaseRepository, cursor: str, page_size: int
) -> list[dict]:
    """Fetch rows with NULL embedding using cursor-based pagination (avoids OFFSET slowdown)."""
    cols = ",".join(
        [
            "case_id",
            "title",
            "citation",
            "catchwords",
            "visa_type",
            "legislation",
            "case_nature",
            "legal_concepts",
            "outcome",
            "text_snippet",
        ]
    )
    for attempt in range(6):
        try:
            q = (
                repo._client.table(TABLE)
                .select(cols)
                .is_("embedding", "null")
                .order("case_id")
            )
            if cursor:
                q = q.gt("case_id", cursor)
            resp = q.limit(page_size).execute()
            return resp.data or []
        except Exception as exc:
            if attempt < 5:
                wait = min(2 ** attempt, 16)
                print(f"  WARN fetch cursor={cursor!r} attempt {attempt+1} failed: {exc}; retry in {wait}s")
                time.sleep(wait)
            else:
                raise
    return []


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Two-stage embedding backfill")
    sub = parser.add_subparsers(dest="command", required=True)

    gen = sub.add_parser("generate", help="Stage embeddings into local SQLite DB")
    gen.add_argument("--provider", choices=["openai", "gemini"], default="openai")
    gen.add_argument("--model", default="")
    gen.add_argument("--stage-db", default=str(DEFAULT_STAGE_DB))
    gen.add_argument("--checkpoint-file", default=str(DEFAULT_GENERATE_CKPT))
    gen.add_argument("--resume", action="store_true")
    gen.add_argument("--start-offset", type=int, default=0)
    gen.add_argument("--max-cases", type=int, default=0)
    gen.add_argument("--page-size", type=int, default=500)
    gen.add_argument("--embed-batch-size", type=int, default=64)
    gen.add_argument("--force", action="store_true")
    gen.add_argument("--price-per-1m", type=float, default=0.02)

    ap = sub.add_parser("apply", help="Apply staged embeddings to Supabase")
    ap.add_argument("--stage-db", default=str(DEFAULT_STAGE_DB))
    ap.add_argument("--write-batch-size", type=int, default=8)
    ap.add_argument("--max-batches", type=int, default=0, help="0 = until stage queue empty")
    ap.add_argument("--max-retries", type=int, default=6)
    ap.add_argument("--retry-base-seconds", type=float, default=0.8)
    return parser.parse_args()


def run_generate(args: argparse.Namespace) -> int:
    load_dotenv()
    stage_db = Path(args.stage_db)
    ckpt_path = Path(args.checkpoint_file)

    provider = args.provider.strip().lower()
    model = args.model.strip()
    if not model:
        model = "models/gemini-embedding-001" if provider == "gemini" else "text-embedding-3-small"

    repo = SupabaseRepository()
    client = make_embedding_client(provider, model)
    conn = open_stage_db(stage_db)

    # Try RPC first; fall back to estimated count if RPC returns 0
    total_rows = int(repo.get_statistics().get("total") or 0)
    if total_rows <= 0:
        resp = repo._client.table("immigration_cases").select(
            "case_id", count="estimated"
        ).limit(0).execute()
        total_rows = int(resp.count or 0)
    if total_rows <= 0:
        print("No rows found in immigration_cases.")
        return 1

    page_size = max(1, min(int(args.page_size), MAX_PAGE_SIZE))
    embed_batch_size = max(1, int(args.embed_batch_size))

    ckpt = load_checkpoint(ckpt_path) if args.resume else {}
    resume_cursor = str(ckpt.get("cursor", "")) if args.resume else ""

    print("Stage-1 generate started")
    print(f"  provider: {provider}")
    print(f"  model: {model}")
    print(f"  resume_cursor: {resume_cursor!r}")
    print(f"  total_rows (estimated): {total_rows:,}")
    print(f"  stage_db: {stage_db}")

    processed = 0
    staged = 0
    skipped = 0
    failed = 0
    embedded_tokens = 0
    started = time.time()

    # Use targeted query: only fetch rows with NULL embedding (cursor-based, no OFFSET)
    cursor = resume_cursor
    while True:
        rows = fetch_rows_needing_embedding(repo, cursor=cursor, page_size=page_size)
        if not rows:
            break

        candidates: list[dict] = []
        for row in rows:
            text = build_embedding_text(row)
            if not text:
                skipped += 1
                processed += 1
                continue
            content_hash = sha256_hex(text)
            candidates.append(
                {
                    "case_id": row["case_id"],
                    "text": text,
                    "content_hash": content_hash,
                }
            )
            processed += 1

        for i in range(0, len(candidates), embed_batch_size):
            chunk = candidates[i : i + embed_batch_size]
            texts = [c["text"] for c in chunk]
            try:
                vectors = client.embed_texts(texts, batch_size=embed_batch_size, task_type="RETRIEVAL_DOCUMENT")
            except Exception as exc:
                failed += len(chunk)
                print(f"  ERROR embedding chunk at cursor={cursor}: {exc}")
                continue

            generated_at = now_iso()
            stage_rows = []
            for c, v in zip(chunk, vectors):
                vec = [float(x) for x in v]
                stage_rows.append(
                    {
                        "case_id": c["case_id"],
                        "provider": provider,
                        "model": model,
                        "dimensions": len(vec),
                        "content_hash": c["content_hash"],
                        "embedding_literal": vector_to_literal(vec),
                        "generated_at": generated_at,
                    }
                )
                embedded_tokens += estimate_tokens(c["text"])
            stage_upsert(conn, stage_rows)
            staged += len(stage_rows)

        cursor = rows[-1]["case_id"]
        elapsed = time.time() - started
        rate = processed / elapsed if elapsed > 0 else 0.0
        est_cost = (embedded_tokens / 1_000_000) * float(args.price_per_1m)
        total_staged, pending_staged = count_stage_rows(conn)
        print(
            f"  progress: cursor={cursor} "
            f"(processed={processed:,}, staged={staged:,}, skipped={skipped:,}, failed={failed:,}, "
            f"stage_total={total_staged:,}, stage_pending={pending_staged:,}, est_cost=${est_cost:.4f}, "
            f"rate={rate:.1f} rows/s)"
        )
        save_checkpoint(
            ckpt_path,
            {
                "cursor": cursor,
                "provider": provider,
                "model": model,
                "processed": processed,
                "staged": staged,
                "skipped": skipped,
                "failed": failed,
                "embedded_tokens": embedded_tokens,
                "updated_at": now_iso(),
            },
        )

    elapsed = time.time() - started
    total_staged, pending_staged = count_stage_rows(conn)
    est_cost = (embedded_tokens / 1_000_000) * float(args.price_per_1m)
    print("\nStage-1 generate completed")
    print(f"  elapsed_seconds: {elapsed:.1f}")
    print(f"  processed_rows: {processed:,}")
    print(f"  staged_rows: {staged:,}")
    print(f"  skipped_rows: {skipped:,}")
    print(f"  failed_rows: {failed:,}")
    print(f"  stage_total_rows: {total_staged:,}")
    print(f"  stage_pending_rows: {pending_staged:,}")
    print(f"  estimated_cost_usd: ${est_cost:.4f}")
    print(f"  stage_db: {stage_db}")
    return 0 if failed == 0 else 2


def _retryable_supabase_error(exc: Exception) -> bool:
    if isinstance(exc, APIError):
        code = str(getattr(exc, "code", "") or "")
        msg = str(exc)
        return code in {"57014", "53300", "08006"} or "statement timeout" in msg.lower()
    msg = str(exc).lower()
    return "timeout" in msg or "temporarily unavailable" in msg


def run_apply(args: argparse.Namespace) -> int:
    load_dotenv()
    stage_db = Path(args.stage_db)
    conn = open_stage_db(stage_db)
    repo = SupabaseRepository()

    write_batch_size = max(1, int(args.write_batch_size))
    max_batches = max(0, int(args.max_batches))
    max_retries = max(1, int(args.max_retries))
    retry_base = max(0.1, float(args.retry_base_seconds))

    print("Stage-2 apply started")
    print(f"  stage_db: {stage_db}")
    print(f"  write_batch_size: {write_batch_size}")
    print(f"  max_batches: {max_batches or 'all'}")

    applied = 0
    failed = 0
    batch_no = 0
    started = time.time()

    while True:
        if max_batches and batch_no >= max_batches:
            break
        batch = fetch_stage_batch(conn, write_batch_size)
        if not batch:
            break
        batch_no += 1

        payload = [
            {
                "case_id": r["case_id"],
                "embedding": r["embedding_literal"],
                "embedding_provider": r["provider"],
                "embedding_model": r["model"],
                "embedding_dimensions": r["dimensions"],
                "embedding_content_hash": r["content_hash"],
                "embedding_updated_at": now_iso(),
            }
            for r in batch
        ]
        case_ids = [r["case_id"] for r in batch]

        write_error = None
        for attempt in range(max_retries):
            try:
                repo._client.table(TABLE).upsert(payload, on_conflict="case_id").execute()
                write_error = None
                break
            except Exception as exc:
                write_error = exc
                if attempt < max_retries - 1 and _retryable_supabase_error(exc):
                    sleep_s = retry_base * (attempt + 1)
                    time.sleep(sleep_s)
                    continue
                break

        if write_error is None:
            mark_applied(conn, case_ids)
            applied += len(case_ids)
        else:
            mark_apply_error(conn, case_ids, str(write_error))
            failed += len(case_ids)

        total, pending = count_stage_rows(conn)
        elapsed = time.time() - started
        rate = applied / elapsed if elapsed > 0 else 0.0
        print(
            f"  batch={batch_no:,} applied={applied:,} failed={failed:,} "
            f"stage_total={total:,} pending={pending:,} rate={rate:.1f} rows/s"
        )

    elapsed = time.time() - started
    total, pending = count_stage_rows(conn)
    print("\nStage-2 apply completed")
    print(f"  elapsed_seconds: {elapsed:.1f}")
    print(f"  applied_rows: {applied:,}")
    print(f"  failed_rows: {failed:,}")
    print(f"  stage_total_rows: {total:,}")
    print(f"  stage_pending_rows: {pending:,}")
    print(f"  stage_db: {stage_db}")
    return 0 if failed == 0 else 2


def main() -> int:
    args = parse_args()
    if args.command == "generate":
        return run_generate(args)
    if args.command == "apply":
        return run_apply(args)
    raise RuntimeError(f"Unknown command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())

