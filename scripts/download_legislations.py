#!/usr/bin/env python3
"""Download Australian legislation text from AustLII, section by section.

Scrapes the 6 immigration-related Commonwealth laws and saves them to
immi_case_downloader/data/legislations.json with full section text.

Usage:
    python scripts/download_legislations.py
    python scripts/download_legislations.py --law migration-act-1958
    python scripts/download_legislations.py --force
    python scripts/download_legislations.py --delay 2.0

Notes:
    - Migration Act 1958 has ~231 sections → ~4 min at 1s delay
    - Run from project root: python scripts/download_legislations.py
    - Skips laws whose last_scraped date matches AustLII last_amended unless --force
"""

import argparse
import json
import logging
import os
import sys

# Add project root to path so we can import the package
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from immi_case_downloader.sources.legislation_scraper import (
    KNOWN_LAWS,
    LegislationScraper,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

DATA_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "immi_case_downloader",
    "data",
    "legislations.json",
)


def load_existing() -> dict:
    """Load existing legislations.json, return empty dict on failure."""
    if not os.path.exists(DATA_PATH):
        return {"legislations": []}
    try:
        with open(DATA_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        logger.warning(f"Could not read existing data: {e}")
        return {"legislations": []}


def save(data: dict) -> None:
    """Atomically write legislations.json."""
    tmp_path = DATA_PATH + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, DATA_PATH)
    logger.info(f"Saved to {DATA_PATH}")


def make_progress_reporter():
    """Return a progress callback that prints to console."""
    def callback(law_id: str, current: int, total: int, section_id: str) -> None:
        if section_id == "done":
            print(f"  ✓ {law_id}: {total} sections complete")
        elif total > 0:
            pct = int(current / total * 100)
            bar = "█" * (pct // 5) + "░" * (20 - pct // 5)
            print(f"\r  [{bar}] {pct:3d}%  {current}/{total}  {section_id}    ", end="", flush=True)

    return callback


def should_skip(existing_law: dict | None, force: bool) -> bool:
    """Return True if the law is up to date and should be skipped."""
    if force or not existing_law:
        return False
    if not existing_law.get("last_scraped") or not existing_law.get("sections"):
        return False
    # If we have sections already scraped, skip unless --force
    return bool(existing_law.get("sections_count", 0) > 0)


def main() -> int:
    parser = argparse.ArgumentParser(description="Download Australian legislation from AustLII")
    parser.add_argument(
        "--law",
        choices=list(KNOWN_LAWS.keys()),
        help="Scrape only this law (default: all)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-scrape even if already downloaded",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Seconds between requests (default: 1.0)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available laws and exit",
    )
    args = parser.parse_args()

    if args.list:
        print("Available laws:")
        for law_id, meta in KNOWN_LAWS.items():
            print(f"  {law_id:45s}  {meta['title']}")
        return 0

    # Determine which laws to scrape
    law_ids = [args.law] if args.law else list(KNOWN_LAWS.keys())

    # Load existing data to check what's already scraped
    existing_data = load_existing()
    existing_by_id = {leg["id"]: leg for leg in existing_data.get("legislations", [])}

    # Filter out laws that are already up to date (unless --force)
    to_scrape = []
    for law_id in law_ids:
        if should_skip(existing_by_id.get(law_id), args.force):
            logger.info(f"Skipping {law_id} (already scraped, use --force to re-scrape)")
        else:
            to_scrape.append(law_id)

    if not to_scrape:
        logger.info("All laws already scraped. Use --force to re-download.")
        return 0

    logger.info(f"Scraping {len(to_scrape)} laws: {', '.join(to_scrape)}")
    print()

    scraper = LegislationScraper(delay=args.delay)
    progress = make_progress_reporter()

    scraped_by_id: dict[str, dict] = {}
    errors = []

    for law_id in to_scrape:
        meta = KNOWN_LAWS[law_id]
        print(f"\n{'─' * 60}")
        print(f"Scraping: {meta['title']}")
        print(f"AustLII:  https://www.austlii.edu.au/au/legis/cth/{meta['austlii_id']}/")
        print()
        result = scraper.scrape_one(law_id, progress_callback=progress)
        print()  # newline after progress bar
        if result:
            scraped_by_id[law_id] = result
            logger.info(f"  ✓ {meta['title']}: {result['sections_count']} sections")
        else:
            errors.append(law_id)
            logger.error(f"  ✗ {meta['title']}: failed to scrape")

    # Merge results with existing data
    all_laws = []
    for law_id in KNOWN_LAWS:  # Preserve canonical order
        if law_id in scraped_by_id:
            all_laws.append(scraped_by_id[law_id])
        elif law_id in existing_by_id:
            all_laws.append(existing_by_id[law_id])
        else:
            # Law not yet scraped — include skeleton from KNOWN_LAWS
            meta = KNOWN_LAWS[law_id]
            all_laws.append({
                "id": law_id,
                "title": meta["title"],
                "austlii_id": meta["austlii_id"],
                "shortcode": meta["shortcode"],
                "type": meta["type"],
                "jurisdiction": meta["jurisdiction"],
                "description": meta["description"],
                "sections_count": 0,
                "last_amended": "",
                "last_scraped": "",
                "sections": [],
            })

    output = {
        "_comment": "Populated by scripts/download_legislations.py — do not edit sections manually",
        "legislations": all_laws,
    }
    save(output)

    print(f"\n{'─' * 60}")
    print(f"Done: {len(scraped_by_id)} scraped, {len(errors)} failed")
    if errors:
        print(f"Failed laws: {', '.join(errors)}")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
