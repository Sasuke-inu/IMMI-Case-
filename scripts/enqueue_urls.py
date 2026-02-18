"""
Enqueue AustLII case URLs to the Cloudflare Worker for scraping.

Two modes:
  --direct    Direct HTTP calls to /scrape (bypasses Queue, best for large batches)
  (default)   Queue-based via /enqueue (for small batches when Queue isn't busy)

Usage:
    python scripts/enqueue_urls.py --court HCA --direct         # direct mode (recommended)
    python scripts/enqueue_urls.py --court RRTA --direct -j 20  # 20 concurrent
    python scripts/enqueue_urls.py --dry-run                    # show counts only
    python scripts/enqueue_urls.py --court HCA                  # queue mode
"""

import argparse
import asyncio
import json
import os
import sys
import time

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.cloudflare_config import (
    WORKER_URL,
    WORKER_AUTH_TOKEN,
    JSON_PATH,
    TEXT_DIR,
    validate_config,
)
from immi_case_downloader.models import ImmigrationCase


def load_cases_needing_download(
    court_filter: str | None = None,
    limit: int | None = None,
) -> list[dict]:
    """Load cases from JSON that are missing full text."""
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # JSON has a wrapper: {"total_cases": ..., "cases": [...]}
    raw = data["cases"] if isinstance(data, dict) and "cases" in data else data

    # Build set of existing text files for fast lookup
    existing_files = set()
    if TEXT_DIR.exists():
        existing_files = {f.name for f in TEXT_DIR.iterdir() if f.suffix == ".txt"}

    cases = []
    for item in raw:
        case = ImmigrationCase.from_dict(item)
        case.ensure_id()

        # Filter by court if specified
        if court_filter and case.court_code != court_filter:
            continue

        # Skip if already has full_text_path
        if case.full_text_path and os.path.exists(case.full_text_path):
            continue

        # Skip if text file already exists on disk
        if case.citation:
            filename = "".join(
                c if c.isalnum() or c in " -_[]" else "_" for c in case.citation
            )
            filename = filename.strip()[:100] + ".txt"
            if filename in existing_files:
                continue

        # Must have a URL
        if not case.url:
            continue

        cases.append({
            "case_id": case.case_id,
            "url": case.url.rstrip("."),  # Strip trailing dots (ARTA bug)
            "citation": case.citation,
            "court_code": case.court_code,
            "title": case.title,
        })

    if limit:
        cases = cases[:limit]

    return cases


def enqueue_batch(
    jobs: list[dict],
    batch_size: int = 100,
    delay: float = 1.0,
) -> tuple[int, int, list[str]]:
    """Send jobs to Worker in batches with retry. Returns (queued, skipped, errors)."""
    total_queued = 0
    total_skipped = 0
    all_errors: list[str] = []

    headers = {
        "Content-Type": "application/json",
        "X-Auth-Token": WORKER_AUTH_TOKEN,
    }

    total_batches = (len(jobs) + batch_size - 1) // batch_size

    for i in range(0, len(jobs), batch_size):
        batch = jobs[i : i + batch_size]
        payload = {"jobs": batch}
        batch_num = i // batch_size + 1

        # Retry with exponential backoff
        max_retries = 3
        for attempt in range(max_retries):
            try:
                resp = requests.post(
                    f"{WORKER_URL}/enqueue",
                    json=payload,
                    headers=headers,
                    timeout=60,
                )
                resp.raise_for_status()
                result = resp.json()
                total_queued += result.get("queued", 0)
                total_skipped += result.get("skipped", 0)
                if result.get("errors"):
                    all_errors.extend(result["errors"])

                print(
                    f"  Batch {batch_num}/{total_batches}: "
                    f"queued={result.get('queued', 0)}, "
                    f"skipped={result.get('skipped', 0)}"
                )
                break  # Success

            except requests.RequestException as e:
                if attempt < max_retries - 1:
                    delay = 2 ** (attempt + 1)  # 2, 4 seconds
                    print(f"  Batch {batch_num}: retry {attempt + 1}/{max_retries} after {delay}s ({e})")
                    time.sleep(delay)
                else:
                    error_msg = f"Batch {batch_num} failed after {max_retries} retries: {e}"
                    print(f"  ERROR: {error_msg}")
                    all_errors.append(error_msg)

        # Delay between batches to avoid Queue rate limiting
        if i + batch_size < len(jobs):
            time.sleep(delay)

    return total_queued, total_skipped, all_errors


# ─── Direct Mode (bypasses Queue) ─────────────────────────────────────────────

async def direct_scrape(
    jobs: list[dict],
    concurrency: int = 20,
) -> tuple[int, int, int, list[str]]:
    """Call /scrape directly with controlled concurrency.
    Returns (success, skipped, failed, errors).
    """
    import aiohttp

    semaphore = asyncio.Semaphore(concurrency)
    success = 0
    skipped = 0
    failed = 0
    errors: list[str] = []
    total = len(jobs)
    start_time = time.time()

    headers = {
        "Content-Type": "application/json",
        "X-Auth-Token": WORKER_AUTH_TOKEN,
    }

    async def process_one(session: aiohttp.ClientSession, job: dict, idx: int):
        nonlocal success, skipped, failed
        async with semaphore:
            try:
                async with session.post(
                    f"{WORKER_URL}/scrape",
                    json=job,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=60),
                ) as resp:
                    result = await resp.json()
                    if result.get("skipped"):
                        skipped += 1
                    elif result.get("success"):
                        success += 1
                    else:
                        failed += 1
                        if failed <= 10:
                            errors.append(
                                f"{job['case_id']}: {result.get('error', 'unknown')}"
                            )
            except Exception as e:
                failed += 1
                if failed <= 10:
                    errors.append(f"{job['case_id']}: {e}")

            done = success + skipped + failed
            if done % 200 == 0 and done > 0:
                elapsed = time.time() - start_time
                rate = done / elapsed if elapsed > 0 else 0
                eta = (total - done) / rate if rate > 0 else 0
                print(
                    f"  Progress: {done:,}/{total:,} "
                    f"(ok:{success:,} skip:{skipped:,} fail:{failed}) "
                    f"| {rate:.1f}/s | ETA: {eta/60:.0f}m"
                )

    connector = aiohttp.TCPConnector(limit=concurrency + 5)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [process_one(session, job, i) for i, job in enumerate(jobs)]
        await asyncio.gather(*tasks)

    return success, skipped, failed, errors


def main():
    parser = argparse.ArgumentParser(
        description="Enqueue AustLII URLs for Cloudflare Worker scraping"
    )
    parser.add_argument(
        "--court",
        type=str,
        help="Filter by court code (e.g., ARTA, HCA, FMCA, MRTA)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Max number of cases to enqueue",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Number of jobs per HTTP request (default: 100)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Delay between batches in seconds (default: 1.0, use 5+ for large queues)",
    )
    parser.add_argument(
        "--direct",
        action="store_true",
        help="Use direct /scrape mode (bypasses Queue, recommended for large batches)",
    )
    parser.add_argument(
        "-j", "--concurrency",
        type=int,
        default=20,
        help="Concurrent requests in direct mode (default: 20)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show counts without actually enqueuing",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("AustLII Scraper — Enqueue URLs")
    print("=" * 60)

    # Validate config
    if not args.dry_run:
        errors = validate_config()
        if errors:
            for e in errors:
                print(f"  CONFIG ERROR: {e}")
            print("\n  Create scripts/.env with required values.")
            sys.exit(1)

    # Load cases
    print(f"\nLoading cases from {JSON_PATH}...")
    cases = load_cases_needing_download(
        court_filter=args.court,
        limit=args.limit,
    )

    if not cases:
        print("  No cases need downloading!")
        return

    # Show breakdown by court
    court_counts: dict[str, int] = {}
    for c in cases:
        code = c["court_code"]
        court_counts[code] = court_counts.get(code, 0) + 1

    print(f"\n  Total cases to enqueue: {len(cases)}")
    print("  By court:")
    for code, count in sorted(court_counts.items(), key=lambda x: -x[1]):
        print(f"    {code}: {count:,}")

    if args.dry_run:
        print("\n  DRY RUN — no jobs enqueued")
        return

    if args.direct:
        # Direct mode: call /scrape with concurrency control
        print(f"\nDirect scraping via {WORKER_URL}/scrape (concurrency={args.concurrency})...")
        success, skipped, failed, errors = asyncio.run(
            direct_scrape(cases, concurrency=args.concurrency)
        )
        print(f"\nDone! Success: {success:,}, Skipped: {skipped:,}, Failed: {failed:,}")
    else:
        # Queue mode: batch enqueue to /enqueue
        print(f"\nEnqueuing to {WORKER_URL}/enqueue ...")
        queued, skipped, errors = enqueue_batch(
            cases, batch_size=args.batch_size, delay=args.delay
        )
        print(f"\nDone! Queued: {queued}, Skipped: {skipped}")

    if errors:
        print(f"Errors ({len(errors)}):")
        for e in errors[:10]:
            print(f"  - {e}")


if __name__ == "__main__":
    main()
