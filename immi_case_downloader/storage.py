"""Storage and export utilities for immigration cases."""

import csv
import json
import os
import logging
from pathlib import Path

import pandas as pd

from .config import OUTPUT_DIR, CASES_CSV, CASES_JSON, TEXT_CASES_DIR
from .models import ImmigrationCase

logger = logging.getLogger(__name__)

CASE_FIELDS = [
    "case_id",
    "citation",
    "title",
    "court",
    "court_code",
    "date",
    "year",
    "url",
    "judges",
    "catchwords",
    "outcome",
    "visa_type",
    "legislation",
    "text_snippet",
    "full_text_path",
    "source",
]


def ensure_output_dirs(base_dir: str = OUTPUT_DIR):
    """Create output directory structure."""
    Path(base_dir).mkdir(parents=True, exist_ok=True)
    Path(base_dir, TEXT_CASES_DIR).mkdir(parents=True, exist_ok=True)
    return base_dir


def save_cases_csv(cases: list[ImmigrationCase], base_dir: str = OUTPUT_DIR):
    """Save cases to a CSV file."""
    filepath = os.path.join(base_dir, CASES_CSV)
    rows = [case.to_dict() for case in cases]

    df = pd.DataFrame(rows, columns=CASE_FIELDS)
    df.to_csv(filepath, index=False, encoding="utf-8-sig")

    logger.info(f"Saved {len(cases)} cases to {filepath}")
    return filepath


def save_cases_json(cases: list[ImmigrationCase], base_dir: str = OUTPUT_DIR):
    """Save cases to a JSON file."""
    filepath = os.path.join(base_dir, CASES_JSON)
    data = {
        "total_cases": len(cases),
        "courts": list({c.court for c in cases if c.court}),
        "year_range": {
            "min": min((c.year for c in cases if c.year), default=0),
            "max": max((c.year for c in cases if c.year), default=0),
        },
        "cases": [case.to_dict() for case in cases],
    }

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    logger.info(f"Saved {len(cases)} cases to {filepath}")
    return filepath


def save_case_text(
    case: ImmigrationCase, text: str, base_dir: str = OUTPUT_DIR
) -> str:
    """Save full case text to a file.

    Returns:
        Path to the saved text file.
    """
    text_dir = os.path.join(base_dir, TEXT_CASES_DIR)
    Path(text_dir).mkdir(parents=True, exist_ok=True)

    # Create filename from citation or case ID
    filename = case.citation or case.case_id or case.title
    # Sanitize filename
    filename = "".join(c if c.isalnum() or c in " -_[]" else "_" for c in filename)
    filename = filename.strip()[:100]
    if not filename:
        filename = f"case_{hash(case.url) % 100000}"
    filename = f"{filename}.txt"

    filepath = os.path.join(text_dir, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(f"Title: {case.title}\n")
        f.write(f"Citation: {case.citation}\n")
        f.write(f"Court: {case.court}\n")
        f.write(f"Date: {case.date}\n")
        f.write(f"URL: {case.url}\n")
        f.write(f"{'='*80}\n\n")
        f.write(text)

    case.full_text_path = filepath
    return filepath


def load_cases_csv(base_dir: str = OUTPUT_DIR) -> list[dict]:
    """Load previously downloaded cases from CSV."""
    filepath = os.path.join(base_dir, CASES_CSV)
    if not os.path.exists(filepath):
        return []

    df = pd.read_csv(filepath, encoding="utf-8-sig")
    return df.to_dict("records")


def generate_summary_report(cases: list[ImmigrationCase], base_dir: str = OUTPUT_DIR):
    """Generate a summary report of downloaded cases."""
    filepath = os.path.join(base_dir, "summary_report.txt")

    # Group by court
    by_court = {}
    for case in cases:
        court = case.court or "Unknown"
        by_court.setdefault(court, []).append(case)

    # Group by year
    by_year = {}
    for case in cases:
        year = case.year or 0
        by_year.setdefault(year, []).append(case)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write("IMMIGRATION CASE DOWNLOAD SUMMARY REPORT\n")
        f.write("=" * 60 + "\n\n")
        f.write(f"Total Cases: {len(cases)}\n\n")

        f.write("Cases by Court/Tribunal:\n")
        f.write("-" * 40 + "\n")
        for court, court_cases in sorted(by_court.items()):
            f.write(f"  {court}: {len(court_cases)}\n")

        f.write(f"\nCases by Year:\n")
        f.write("-" * 40 + "\n")
        for year, year_cases in sorted(by_year.items()):
            if year:
                f.write(f"  {year}: {len(year_cases)}\n")

        # Visa types mentioned
        visa_types = {c.visa_type for c in cases if c.visa_type}
        if visa_types:
            f.write(f"\nVisa Types Found:\n")
            f.write("-" * 40 + "\n")
            for vt in sorted(visa_types):
                f.write(f"  - {vt}\n")

    logger.info(f"Summary report saved to {filepath}")
    return filepath
