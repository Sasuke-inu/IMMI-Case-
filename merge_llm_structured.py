#!/usr/bin/env python3
"""Merge LLM structured extraction results into the main CSV.

Reads result_XXXXX.json files from downloaded_cases/llm_structured_results/
and updates the corresponding fields in immigration_cases.csv.

Safe to run multiple times — only updates empty/missing fields by default.
Use --overwrite to replace existing values.

Usage:
    python merge_llm_structured.py                    # merge, only fill empty
    python merge_llm_structured.py --overwrite        # replace existing values too
    python merge_llm_structured.py --report           # show stats only, no merge
"""

import argparse
import csv
import json
import os
import glob
from collections import Counter
from pathlib import Path

CSV_PATH = Path("downloaded_cases/immigration_cases.csv")
RESULTS_DIR = Path("downloaded_cases/llm_structured_results")

TARGET_FIELDS = [
    "country_of_origin", "is_represented", "representative",
    "respondent", "visa_subclass_number",
]


def load_csv() -> list[dict]:
    with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def save_csv(rows: list[dict]):
    if not rows:
        return
    fieldnames = list(rows[0].keys())
    tmp_path = CSV_PATH.with_suffix(".csv.tmp")
    with open(tmp_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    os.replace(str(tmp_path), str(CSV_PATH))


def main():
    parser = argparse.ArgumentParser(description="Merge LLM structured results into CSV")
    parser.add_argument("--overwrite", action="store_true",
                        help="Overwrite existing field values")
    parser.add_argument("--report", action="store_true",
                        help="Show stats only, don't merge")
    args = parser.parse_args()

    print("Loading CSV...")
    rows = load_csv()
    print(f"  {len(rows)} records")

    # Find result files
    result_files = sorted(glob.glob(str(RESULTS_DIR / "result_*.json")))
    print(f"  Found {len(result_files)} result files")

    if not result_files:
        print("No result files found!")
        return

    updates = Counter()
    field_updates = Counter()
    errors = 0
    total_results = 0

    for rf in result_files:
        try:
            with open(rf, "r", encoding="utf-8") as f:
                results = json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"  Error reading {rf}: {e}")
            errors += 1
            continue

        for item in results:
            total_results += 1
            idx = item.get("idx")
            if idx is None:
                continue
            idx = int(idx)
            if idx < 0 or idx >= len(rows):
                updates["out_of_range"] += 1
                continue

            for field in TARGET_FIELDS:
                new_val = item.get(field, "").strip()
                if not new_val:
                    continue

                current_val = rows[idx].get(field, "").strip()

                if args.report:
                    if not current_val:
                        field_updates[f"{field}_would_fill"] += 1
                    elif current_val != new_val:
                        field_updates[f"{field}_would_change"] += 1
                    else:
                        field_updates[f"{field}_matches"] += 1
                else:
                    if not current_val or args.overwrite:
                        if new_val != current_val:
                            rows[idx][field] = new_val
                            field_updates[field] += 1

    print(f"\nResults processed: {total_results}")
    print(f"  File errors: {errors}")

    if args.report:
        print("\nProjected changes:")
        for key in sorted(field_updates.keys()):
            print(f"  {key}: {field_updates[key]:,}")
    else:
        print("\nFields updated:")
        for field in TARGET_FIELDS:
            count = field_updates.get(field, 0)
            print(f"  {field}: {count:,}")

        total_updated = sum(field_updates.values())
        if total_updated > 0:
            print(f"\nSaving CSV ({total_updated:,} field updates)...")
            save_csv(rows)
            print("  Done!")
        else:
            print("\nNo updates to save.")

    # Coverage report
    print("\nCoverage:")
    total = len(rows)
    for field in TARGET_FIELDS + ["applicant_name", "hearing_date"]:
        filled = sum(1 for r in rows if r.get(field, "").strip())
        print(f"  {field:25s}: {filled:>6,}/{total} ({filled*100/total:.1f}%)")


if __name__ == "__main__":
    main()
