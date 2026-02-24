#!/usr/bin/env python3
"""Backfill pgvector embeddings for immigration_cases in Supabase.

Features:
- Full-table batch processing with checkpoint resume
- Supports OpenAI and Gemini embedding providers
- Content-hash incremental updates (skip unchanged rows)
- Cost estimate output (token-based)

Examples:
    python3 scripts/backfill_case_embeddings.py --provider openai
    python3 scripts/backfill_case_embeddings.py --provider gemini --resume
    python3 scripts/backfill_case_embeddings.py --dry-run --max-cases 5000
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

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
DEFAULT_CHECKPOINT = PROJECT_ROOT / "downloaded_cases" / "embedding_backfill_checkpoint.json"
MAX_PAGE_SIZE = 1000


def build_embedding_text(row: dict) -> str:
    """Build stable embedding source text from row fields."""
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


def vector_to_literal(vector: list[float]) -> str:
    """Convert embedding vector to PostgreSQL vector literal."""
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
    resp = (
        repo._client.table(TABLE)
        .select(cols)
        .range(offset, offset + page_size - 1)
        .execute()
    )
    return resp.data or []


def update_embeddings(repo: SupabaseRepository, payloads: list[dict]) -> None:
    if not payloads:
        return
    repo._client.table(TABLE).upsert(payloads, on_conflict="case_id").execute()


def verify_embedding_schema(repo: SupabaseRepository) -> None:
    """Fail fast when embedding columns are not yet migrated."""
    try:
        (
            repo._client.table(TABLE)
            .select(
                "case_id,embedding,embedding_provider,"
                "embedding_model,embedding_dimensions,embedding_content_hash"
            )
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise RuntimeError(
            "Embedding columns are missing. "
            "Please apply migration "
            "'supabase/migrations/20260223103000_add_pgvector_embeddings.sql' first."
        ) from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill Supabase case embeddings")
    parser.add_argument("--provider", choices=["openai", "gemini"], default="openai")
    parser.add_argument(
        "--model",
        default="",
        help=(
            "Embedding model override. "
            "Default: text-embedding-3-small (openai), "
            "models/gemini-embedding-001 (gemini)"
        ),
    )
    parser.add_argument("--page-size", type=int, default=500, help="Rows read per DB page")
    parser.add_argument("--embed-batch-size", type=int, default=32, help="Texts per embedding API call")
    parser.add_argument("--write-batch-size", type=int, default=16, help="Rows per DB upsert")
    parser.add_argument("--start-offset", type=int, default=0, help="Start offset (overrides checkpoint)")
    parser.add_argument("--max-cases", type=int, default=0, help="Max rows to process (0 = all)")
    parser.add_argument("--force", action="store_true", help="Re-embed all rows, ignore hash/provider/model")
    parser.add_argument("--dry-run", action="store_true", help="Estimate only, no DB writes")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint file")
    parser.add_argument("--checkpoint-file", default=str(DEFAULT_CHECKPOINT))
    parser.add_argument("--price-per-1m", type=float, default=0.02, help="Cost estimate price (USD per 1M tokens)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    load_dotenv()

    page_size = max(1, min(args.page_size, MAX_PAGE_SIZE))
    embed_batch_size = max(1, args.embed_batch_size)
    write_batch_size = max(1, args.write_batch_size)
    checkpoint_path = Path(args.checkpoint_file)

    provider = args.provider.strip().lower()
    model = args.model.strip()
    if not model:
        model = "models/gemini-embedding-001" if provider == "gemini" else "text-embedding-3-small"

    try:
        repo = SupabaseRepository()
        verify_embedding_schema(repo)
    except Exception as exc:
        print(f"ERROR: {exc}")
        return 1
    stats = repo.get_statistics()
    total_rows = int(stats.get("total") or 0)
    if total_rows <= 0:
        print("No rows found in immigration_cases.")
        return 1

    checkpoint = load_checkpoint(checkpoint_path) if args.resume else {}
    offset = args.start_offset if args.start_offset > 0 else int(checkpoint.get("offset", 0))
    offset = max(0, min(offset, total_rows))

    if args.max_cases and args.max_cases > 0:
        end_offset = min(total_rows, offset + args.max_cases)
    else:
        end_offset = total_rows

    print("Starting embedding backfill")
    print(f"  provider: {provider}")
    print(f"  model: {model}")
    print(f"  total_rows: {total_rows:,}")
    print(f"  start_offset: {offset:,}")
    print(f"  end_offset: {end_offset:,}")
    print(f"  page_size: {page_size}")
    print(f"  embed_batch_size: {embed_batch_size}")
    print(f"  write_batch_size: {write_batch_size}")
    print(f"  dry_run: {args.dry_run}")
    print(f"  force: {args.force}")
    print(f"  checkpoint: {checkpoint_path}")

    client = None if args.dry_run else make_embedding_client(provider, model)

    processed = 0
    embedded = 0
    skipped = 0
    failures = 0
    embedded_tokens = 0
    started = time.time()

    while offset < end_offset:
        to_read = min(page_size, end_offset - offset)
        rows = fetch_rows(repo, offset=offset, page_size=to_read)
        if not rows:
            break

        # Build candidate list for this page
        candidates: list[dict] = []
        for row in rows:
            text = build_embedding_text(row)
            if not text:
                skipped += 1
                processed += 1
                continue

            content_hash = sha256_hex(text)
            if should_reembed(
                row,
                provider=provider,
                model=model,
                content_hash=content_hash,
                force=args.force,
            ):
                candidates.append({
                    "case_id": row["case_id"],
                    "text": text,
                    "hash": content_hash,
                })
            else:
                skipped += 1
            processed += 1

        # Dry-run: only token/cost estimation.
        if args.dry_run:
            embedded_tokens += sum(estimate_tokens(item["text"]) for item in candidates)
            embedded += len(candidates)
        else:
            # Embed and write in chunks
            for chunk_start in range(0, len(candidates), embed_batch_size):
                chunk = candidates[chunk_start:chunk_start + embed_batch_size]
                texts = [item["text"] for item in chunk]
                try:
                    vectors = client.embed_texts(texts, batch_size=embed_batch_size, task_type="RETRIEVAL_DOCUMENT")
                except Exception as exc:
                    failures += len(chunk)
                    print(f"  ERROR embedding chunk at offset={offset:,}: {exc}")
                    continue

                now_iso = datetime.now(timezone.utc).isoformat()
                payloads = []
                for item, vector in zip(chunk, vectors):
                    vector_list = [float(v) for v in vector]
                    payloads.append({
                        "case_id": item["case_id"],
                        "embedding": vector_to_literal(vector_list),
                        "embedding_provider": provider,
                        "embedding_model": model,
                        "embedding_dimensions": len(vector_list),
                        "embedding_content_hash": item["hash"],
                        "embedding_updated_at": now_iso,
                    })
                    embedded_tokens += estimate_tokens(item["text"])

                # Write embeddings in smaller upsert batches
                for write_start in range(0, len(payloads), write_batch_size):
                    write_chunk = payloads[write_start:write_start + write_batch_size]
                    try:
                        update_embeddings(repo, write_chunk)
                        embedded += len(write_chunk)
                    except Exception as exc:
                        failures += len(write_chunk)
                        print(f"  ERROR writing chunk at offset={offset:,}: {exc}")

        offset += len(rows)
        elapsed = time.time() - started
        rate = processed / elapsed if elapsed > 0 else 0.0
        est_cost = (embedded_tokens / 1_000_000) * args.price_per_1m
        print(
            f"  progress: {offset:,}/{end_offset:,} "
            f"(processed={processed:,}, embedded={embedded:,}, skipped={skipped:,}, "
            f"failed={failures:,}, est_cost=${est_cost:.4f}, rate={rate:.1f} rows/s)"
        )

        checkpoint_payload = {
            "offset": offset,
            "provider": provider,
            "model": model,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "processed": processed,
            "embedded": embedded,
            "skipped": skipped,
            "failures": failures,
            "embedded_tokens": embedded_tokens,
        }
        save_checkpoint(checkpoint_path, checkpoint_payload)

    elapsed = time.time() - started
    avg_tokens_per_case = (embedded_tokens / embedded) if embedded else 0.0
    projected_full_cost = (
        ((avg_tokens_per_case * total_rows) / 1_000_000) * args.price_per_1m
        if avg_tokens_per_case > 0
        else 0.0
    )
    est_cost = (embedded_tokens / 1_000_000) * args.price_per_1m

    print("\nBackfill completed")
    print(f"  elapsed_seconds: {elapsed:.1f}")
    print(f"  processed_rows: {processed:,}")
    print(f"  embedded_rows: {embedded:,}")
    print(f"  skipped_rows: {skipped:,}")
    print(f"  failed_rows: {failures:,}")
    print(f"  embedded_tokens: {embedded_tokens:,}")
    print(f"  estimated_cost_usd: ${est_cost:.4f}")
    if avg_tokens_per_case > 0:
        print(
            f"  projected_full_table_cost_usd (based on avg tokens/case): "
            f"${projected_full_cost:.2f}"
        )
    print(f"  checkpoint_file: {checkpoint_path}")
    return 0 if failures == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
