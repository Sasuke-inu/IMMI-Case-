#!/usr/bin/env python3
"""Build alias -> full-name judge overrides from bios + official public listings.

Writes:
  immi_case_downloader/data/judge_name_overrides.json

Usage:
  python3 scripts/build_judge_name_overrides.py
  python3 scripts/build_judge_name_overrides.py --output /tmp/judge_name_overrides.json
"""

from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "immi_case_downloader" / "data" / "judge_name_overrides.json"
DEFAULT_BIOS = ROOT / "downloaded_cases" / "judge_bios.json"

FCFCOA_CURRENT_JUDGES_URL = "https://www.fcfcoa.gov.au/judges"
FCFCOA_FORMER_JUDGES_URL = "https://www.fcfcoa.gov.au/judges/former-judges"
FCFCOA_CURRENT_JUDGES_ALPHA_URL = "https://www.fcfcoa.gov.au/Judges"
FCFCOA_FORMER_JUDGES_ALPHA_URL = "https://www.fcfcoa.gov.au/Judges/former-judges"
FEDERAL_COURT_CURRENT_JUDGES_URL = (
    "https://www.fedcourt.gov.au/about/judges/current-judges-appointment/current-judges"
)
FEDERAL_COURT_FORMER_JUDGES_URL = "https://www.fedcourt.gov.au/about/judges/former-judges"

SOURCE_URLS = [
    FCFCOA_CURRENT_JUDGES_URL,
    FCFCOA_FORMER_JUDGES_URL,
    FCFCOA_CURRENT_JUDGES_ALPHA_URL,
    FCFCOA_FORMER_JUDGES_ALPHA_URL,
    FEDERAL_COURT_CURRENT_JUDGES_URL,
    FEDERAL_COURT_FORMER_JUDGES_URL,
]

TITLE_PREFIX_RE = re.compile(
    r"^(?:The\s+Hon(?:ourable)?\.?\s+|Hon(?:ourable)?\.?\s+|"
    r"Chief\s+Justice\s+|Chief\s+Judge\s+|Justice\s+|Judge\s+|"
    r"Senior\s+Member\s+|Deputy\s+President\s+|Deputy\s+Member\s+|"
    r"Deputy\s+|Principal\s+Member\s+|Member\s+|Magistrate\s+|"
    r"President\s+|Registrar\s+|Mr\.?\s+|Mrs\.?\s+|Ms\.?\s+|Miss\s+|"
    r"Dr\.?\s+|Prof\.?\s+)",
    re.IGNORECASE,
)

POSTNOMINALS = {
    "ac",
    "ao",
    "am",
    "kc",
    "qc",
    "sc",
    "obe",
    "mbe",
    "psm",
    "oam",
    "cvo",
}

SURNAME_BLOCKLIST = {
    "results",
    "judge",
    "justice",
    "member",
    "chief",
    "deputy",
    "president",
    "former",
    "judges",
}

MANUAL_VERIFIED_OVERRIDES = {
    "street": "Judge Alexander 'Sandy' Whistler Street SC",
    "driver": "Lewis Rolf Driver AM",
    "emmett": "The Honourable Arthur Robert Emmett AO KC",
}


def _clean_text(value: str) -> str:
    cleaned = html.unescape((value or "").strip())
    cleaned = re.sub(r"\*+$", "", cleaned).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def _fetch_html(url: str) -> str:
    user_agent = "Mozilla/5.0"
    req = Request(url, headers={"User-Agent": user_agent})
    try:
        with urlopen(req, timeout=8) as response:  # noqa: S310 - trusted public sources
            return response.read().decode("utf-8", "ignore")
    except Exception:
        result = subprocess.run(
            ["curl", "-L", "--max-time", "20", "-A", user_agent, "-s", url],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0 or not result.stdout.strip():
            raise RuntimeError(f"Failed to fetch URL: {url}")
        return result.stdout


def _extract_h3_names(page_html: str) -> list[str]:
    names: list[str] = []
    for match in re.finditer(r"<h3[^>]*>(.*?)</h3>", page_html, flags=re.IGNORECASE | re.DOTALL):
        text = _clean_text(re.sub(r"<[^>]+>", "", match.group(1)))
        if not text:
            continue
        lower = text.lower()
        if "no results" in lower or lower in {"results"}:
            continue
        if len(text) < 4:
            continue
        names.append(text)
    return names


def _surname_key(full_name: str) -> str:
    value = _clean_text(full_name)
    for _ in range(4):
        match = TITLE_PREFIX_RE.match(value)
        if not match:
            break
        value = value[match.end() :].strip()
    parts = [p for p in re.split(r"\s+", value) if p]
    while parts and parts[-1].rstrip(".,").lower() in POSTNOMINALS:
        parts.pop()
    if not parts:
        return ""
    surname = re.sub(r"[^A-Za-z'\-]", "", parts[-1]).lower()
    if not re.fullmatch(r"[a-z][a-z'\-]{2,}", surname):
        return ""
    if surname in SURNAME_BLOCKLIST:
        return ""
    return surname


def _load_bio_overrides(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as fh:
        payload = json.load(fh)

    overrides: dict[str, str] = {}
    if not isinstance(payload, dict):
        return overrides
    for alias, data in payload.items():
        if not isinstance(alias, str) or not isinstance(data, dict):
            continue
        full_name = _clean_text(str(data.get("full_name") or ""))
        alias_key = alias.strip().lower()
        if not alias_key or not full_name:
            continue
        # Keep high-confidence aliases only:
        # - multi-token aliases are usually explicit person names
        # - single-token aliases must be reasonably long to avoid over-merging
        if " " not in alias_key and (not alias_key.isalpha() or len(alias_key) < 6):
            continue
        overrides[alias_key] = full_name
    return overrides


def _load_existing_overrides(path: Path) -> dict[str, str]:
    """Load existing alias overrides from output file if present."""
    if not path.exists():
        return {}
    try:
        with open(path, encoding="utf-8") as fh:
            payload = json.load(fh)
    except Exception:
        return {}

    if isinstance(payload, dict) and isinstance(payload.get("overrides"), dict):
        raw_map = payload["overrides"]
    elif isinstance(payload, dict):
        raw_map = payload
    else:
        return {}

    out: dict[str, str] = {}
    for alias, full_name in raw_map.items():
        if not isinstance(alias, str) or not isinstance(full_name, str):
            continue
        key = alias.strip().lower()
        value = _clean_text(full_name)
        if key and value:
            out[key] = value
    return out


def _load_fcfcoa_unique_surname_overrides() -> tuple[dict[str, str], list[str]]:
    extracted_names: list[str] = []
    for url in [FCFCOA_CURRENT_JUDGES_URL, FCFCOA_FORMER_JUDGES_URL]:
        try:
            page_html = _fetch_html(url)
            extracted_names.extend(_extract_h3_names(page_html))
        except Exception:
            continue

    unique_names: list[str] = []
    seen: set[str] = set()
    for name in extracted_names:
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        unique_names.append(name)

    by_surname: dict[str, set[str]] = {}
    for name in unique_names:
        surname = _surname_key(name)
        if not surname:
            continue
        by_surname.setdefault(surname, set()).add(name)

    overrides = {
        surname: next(iter(names))
        for surname, names in by_surname.items()
        if len(names) == 1
    }
    return overrides, unique_names


def build_overrides(bios_path: Path, existing_overrides: dict[str, str] | None = None) -> dict:
    bios_overrides = _load_bio_overrides(bios_path)
    fcfcoa_overrides, fcfcoa_names = _load_fcfcoa_unique_surname_overrides()

    merged = dict(fcfcoa_overrides)
    merged.update(bios_overrides)
    merged.update(existing_overrides or {})
    merged.update(MANUAL_VERIFIED_OVERRIDES)

    ordered_overrides = dict(sorted(merged.items(), key=lambda item: item[0]))
    return {
        "version": 1,
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sources": SOURCE_URLS,
        "overrides": ordered_overrides,
        "meta": {
            "total_overrides": len(ordered_overrides),
            "from_judge_bios": len(bios_overrides),
            "from_fcfcoa_unique_surnames": len(fcfcoa_overrides),
            "fcfcoa_names_scraped": len(fcfcoa_names),
            "from_existing_overrides": len(existing_overrides or {}),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build judge alias override JSON.")
    parser.add_argument(
        "--bios",
        type=Path,
        default=DEFAULT_BIOS,
        help=f"Path to judge_bios.json (default: {DEFAULT_BIOS})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output path (default: {DEFAULT_OUTPUT})",
    )
    args = parser.parse_args()

    existing_overrides = _load_existing_overrides(args.output)
    payload = build_overrides(args.bios, existing_overrides=existing_overrides)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print(f"Wrote: {args.output}")
    print(f"Total overrides: {payload['meta']['total_overrides']}")
    print(f"From bios: {payload['meta']['from_judge_bios']}")
    print(f"From FCFCOA unique surnames: {payload['meta']['from_fcfcoa_unique_surnames']}")


if __name__ == "__main__":
    main()
