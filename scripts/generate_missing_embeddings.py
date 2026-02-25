#!/usr/bin/env python3
"""Generate embeddings for rows missing from the stage DB.

Strategy: compare all Supabase case_ids against stage DB, fetch metadata
for missing ones via .in_() (fast, no embedding IS NULL filter needed),
then generate and stage embeddings.
"""

import os
import sqlite3
import time
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

# Reuse helpers from the main backfill script
from two_stage_embedding_backfill import (
    TABLE,
    build_embedding_text,
    count_stage_rows,
    make_embedding_client,
    now_iso,
    open_stage_db,
    sha256_hex,
    stage_upsert,
    vector_to_literal,
)

STAGE_DB = Path(__file__).resolve().parent.parent / "downloaded_cases" / "embedding_stage.sqlite3"
EMBED_BATCH = 64
FETCH_PAGE = 1000  # case_ids per page (no embedding column = fast)
IN_BATCH = 50  # .in_() batch size


def get_staged_ids(conn: sqlite3.Connection) -> set[str]:
    cur = conn.execute("SELECT case_id FROM staged_embeddings")
    return {row[0] for row in cur.fetchall()}


def fetch_all_case_ids(client) -> list[str]:
    """Paginate through all case_ids using cursor-based pagination."""
    all_ids: list[str] = []
    cursor = ""
    while True:
        q = client.table(TABLE).select("case_id").order("case_id").limit(FETCH_PAGE)
        if cursor:
            q = q.gt("case_id", cursor)
        for attempt in range(5):
            try:
                resp = q.execute()
                break
            except Exception as exc:
                if attempt < 4:
                    wait = min(2 ** attempt, 8)
                    print(f"  WARN fetch_ids cursor={cursor!r} attempt {attempt+1}: {exc}; retry in {wait}s")
                    time.sleep(wait)
                else:
                    raise
        rows = resp.data or []
        if not rows:
            break
        for r in rows:
            all_ids.append(r["case_id"])
        cursor = rows[-1]["case_id"]
        print(f"  fetched {len(all_ids):,} case_ids (cursor={cursor})")
    return all_ids


def fetch_rows_by_ids(client, case_ids: list[str]) -> list[dict]:
    """Fetch metadata for specific case_ids using .in_() — very fast."""
    cols = ",".join([
        "case_id", "title", "citation", "catchwords", "visa_type",
        "legislation", "case_nature", "legal_concepts", "outcome", "text_snippet",
    ])
    for attempt in range(5):
        try:
            resp = client.table(TABLE).select(cols).in_("case_id", case_ids).execute()
            return resp.data or []
        except Exception as exc:
            if attempt < 4:
                wait = min(2 ** attempt, 8)
                print(f"  WARN fetch_by_ids attempt {attempt+1}: {exc}; retry in {wait}s")
                time.sleep(wait)
            else:
                raise
    return []


def main():
    project_root = Path(__file__).resolve().parent.parent
    load_dotenv(project_root / ".env")
    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_ANON_KEY") or os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    sb = create_client(url, key)
    conn = open_stage_db(STAGE_DB)
    provider = "openai"
    model = "text-embedding-3-small"
    client = make_embedding_client(provider, model)

    # Step 1: Get all staged case_ids
    print("Step 1: Loading staged case_ids...")
    staged_ids = get_staged_ids(conn)
    print(f"  {len(staged_ids):,} already staged")

    # Step 2: Fetch all case_ids from Supabase
    print("Step 2: Fetching all case_ids from Supabase...")
    all_ids = fetch_all_case_ids(sb)
    print(f"  {len(all_ids):,} total case_ids")

    # Step 3: Find missing
    missing_ids = [cid for cid in all_ids if cid not in staged_ids]
    print(f"Step 3: {len(missing_ids):,} case_ids need embedding generation")

    if not missing_ids:
        print("Nothing to do!")
        return

    # Step 4: Generate embeddings in batches
    print("Step 4: Generating embeddings...")
    processed = 0
    staged = 0
    skipped = 0
    failed = 0
    embedded_tokens = 0
    started = time.time()

    for i in range(0, len(missing_ids), IN_BATCH):
        batch_ids = missing_ids[i : i + IN_BATCH]
        rows = fetch_rows_by_ids(sb, batch_ids)

        candidates = []
        for row in rows:
            text = build_embedding_text(row)
            if not text:
                skipped += 1
                processed += 1
                continue
            content_hash = sha256_hex(text)
            candidates.append({
                "case_id": row["case_id"],
                "text": text,
                "content_hash": content_hash,
            })
            processed += 1

        # Embed in sub-batches
        for j in range(0, len(candidates), EMBED_BATCH):
            chunk = candidates[j : j + EMBED_BATCH]
            texts = [c["text"] for c in chunk]
            try:
                vectors = client.embed_texts(texts, batch_size=EMBED_BATCH, task_type="RETRIEVAL_DOCUMENT")
            except Exception as exc:
                failed += len(chunk)
                print(f"  ERROR embedding batch {i}: {exc}")
                continue

            generated_at = now_iso()
            stage_rows = []
            for c, v in zip(chunk, vectors):
                vec = [float(x) for x in v]
                stage_rows.append({
                    "case_id": c["case_id"],
                    "provider": provider,
                    "model": model,
                    "dimensions": len(vec),
                    "content_hash": c["content_hash"],
                    "embedding_literal": vector_to_literal(vec),
                    "generated_at": generated_at,
                })
                embedded_tokens += len(c["text"]) // 4  # rough token estimate
            stage_upsert(conn, stage_rows)
            staged += len(stage_rows)

        # Progress
        elapsed = time.time() - started
        rate = processed / elapsed if elapsed > 0 else 0.0
        total_staged, pending_staged = count_stage_rows(conn)
        est_cost = (embedded_tokens / 1_000_000) * 0.02
        print(
            f"  [{processed:,}/{len(missing_ids):,}] "
            f"staged={staged:,} skipped={skipped:,} failed={failed:,} "
            f"stage_total={total_staged:,} pending={pending_staged:,} "
            f"cost=${est_cost:.4f} rate={rate:.1f}/s"
        )

    elapsed = time.time() - started
    total_staged, pending_staged = count_stage_rows(conn)
    print(f"\nDone! elapsed={elapsed:.1f}s processed={processed:,} staged={staged:,} "
          f"skipped={skipped:,} failed={failed:,} stage_total={total_staged:,} pending={pending_staged:,}")


if __name__ == "__main__":
    main()
