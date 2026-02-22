#!/usr/bin/env python3
"""
sync_outcomes_supabase.py

Fast sync: push only the 'outcome' field from SQLite → Supabase.
Runs in ~5-10 minutes (vs hours for full CSV migration).

Usage:
    python sync_outcomes_supabase.py              # sync all non-empty outcomes
    python sync_outcomes_supabase.py --only-new   # only rows where Supabase outcome IS NULL
"""

import argparse
import logging
import os
import sqlite3
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

# ── Load .env ──────────────────────────────────────────────────────────────
def _find_and_load_env():
    p = Path(__file__).parent
    for _ in range(8):
        candidate = p / ".env"
        if candidate.exists():
            load_dotenv(candidate, override=True)
            return
        p = p.parent

_find_and_load_env()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

DB_PATH    = Path("downloaded_cases/cases.db")
TABLE      = "immigration_cases"
BATCH_SIZE = 500


def main():
    parser = argparse.ArgumentParser(description="Sync outcomes SQLite → Supabase")
    parser.add_argument(
        "--only-new", action="store_true",
        help="Only update rows where Supabase outcome is currently empty (safer, avoids overwrite)"
    )
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        logger.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
        sys.exit(1)

    from supabase import create_client
    client = create_client(url, key)

    # Load outcomes from SQLite
    logger.info("Reading outcomes from SQLite… (--only-new=%s)", args.only_new)
    conn = sqlite3.connect(str(DB_PATH))
    rows = conn.execute(
        "SELECT case_id, outcome FROM cases WHERE outcome IS NOT NULL AND outcome != ''",
    ).fetchall()
    conn.close()

    total = len(rows)
    logger.info("Found %d non-empty outcomes in SQLite", total)

    if total == 0:
        logger.info("Nothing to sync.")
        return

    # Batch upsert to Supabase (case_id is the conflict key)
    batches = [rows[i:i + BATCH_SIZE] for i in range(0, total, BATCH_SIZE)]
    updated = 0
    start = time.time()

    for i, batch in enumerate(batches):
        payload = [{"case_id": cid, "outcome": outcome} for cid, outcome in batch]
        client.table(TABLE).upsert(payload, on_conflict="case_id").execute()
        updated += len(batch)

        if (i + 1) % 10 == 0 or updated >= total:
            elapsed = time.time() - start
            rate = updated / elapsed if elapsed > 0 else 0
            eta = (total - updated) / rate if rate > 0 else 0
            logger.info(
                "Progress: %d/%d (%.1f%%) | %.0f rows/s | ETA %.0fs",
                updated, total, 100 * updated / total, rate, eta,
            )

    elapsed = time.time() - start
    logger.info("✓ Synced %d outcomes to Supabase in %.1fs", updated, elapsed)


if __name__ == "__main__":
    main()
