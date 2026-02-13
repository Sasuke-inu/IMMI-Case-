#!/usr/bin/env python3
"""Migrate cases from CSV to SQLite database.

Usage:
    python migrate_csv_to_sqlite.py                    # default directory
    python migrate_csv_to_sqlite.py --output mydata    # custom directory
"""

import argparse
import os
import sys
import time

from immi_case_downloader.config import OUTPUT_DIR
from immi_case_downloader.storage import load_all_cases
from immi_case_downloader.sqlite_repository import SqliteRepository


def main():
    parser = argparse.ArgumentParser(description="Migrate CSV data to SQLite")
    parser.add_argument("--output", default=OUTPUT_DIR, help="Data directory")
    args = parser.parse_args()

    csv_path = os.path.join(args.output, "immigration_cases.csv")
    db_path = os.path.join(args.output, "cases.db")

    if not os.path.exists(csv_path):
        print(f"CSV file not found: {csv_path}")
        sys.exit(1)

    print(f"Loading cases from {csv_path}...")
    cases = load_all_cases(args.output)
    print(f"  Loaded {len(cases)} cases from CSV.")

    print(f"Creating SQLite database: {db_path}...")
    repo = SqliteRepository(db_path)

    t0 = time.time()
    count = repo.save_many(cases)
    elapsed = time.time() - t0
    print(f"  Inserted {count} cases in {elapsed:.1f}s.")

    # Verify
    db_count = len(repo.load_all())
    print(f"  Verification: {db_count} cases in SQLite.")

    if db_count == len(cases):
        print("Migration successful! Row counts match.")
    else:
        print(f"WARNING: Row count mismatch! CSV={len(cases)}, SQLite={db_count}")
        sys.exit(1)

    # Show FTS test
    test_query = "visa refusal"
    fts_results = repo.search_text(test_query, limit=5)
    print(f"\n  FTS test '{test_query}': {len(fts_results)} results")
    for c in fts_results[:3]:
        print(f"    - {c.citation}: {c.title[:60]}")

    print(f"\nDone! SQLite database ready at {db_path}")
    print(f"  File size: {os.path.getsize(db_path) / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
