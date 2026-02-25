#!/usr/bin/env python3
"""Extract text from a PDF (native + OCR fallback) and backfill judge overrides.

Usage examples:
  python3 scripts/backfill_judge_overrides_from_pdf.py \
    --pdf "/Users/d/Downloads/KB24 - Honours List Media Notes - Order of Australia AM.pdf"

  python3 scripts/backfill_judge_overrides_from_pdf.py \
    --pdf "/path/to/file.pdf" \
    --text-output downloaded_cases/ocr/honours_kb24.txt \
    --overrides immi_case_downloader/data/judge_name_overrides.json
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OVERRIDES_PATH = ROOT / "immi_case_downloader" / "data" / "judge_name_overrides.json"
DEFAULT_OCR_DIR = ROOT / "downloaded_cases" / "ocr"

TITLE_PREFIX_RE = re.compile(
    r"^(?:His\s+Honour\s+Judge\s+|The\s+Honourable\s+Justice\s+|"
    r"The\s+Honourable\s+|Justice\s+|Judge\s+|Mr\.?\s+|Mrs\.?\s+|"
    r"Ms\.?\s+|Dr\.?\s+)",
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
    "rfd",
    "esm",
}

ENTRY_NAME_RE = re.compile(
    r"^(?:His\s+Honour\s+Judge|The\s+Honourable(?:\s+Justice)?|"
    r"Justice|Judge|Mr|Mrs|Ms|Dr)\s+[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,8}(?:,\s*[A-Z]{2,4}.*)?$"
)

JUDICIARY_STRONG_CONTEXT_RE = re.compile(
    r"service to the judiciary|"
    r"federal\s+circuit\s+and\s+family\s+court|"
    r"federal\s+magistrates\s+court|"
    r"federal\s+court\s+of\s+australia|"
    r"family\s+court\s+of\s+australia|"
    r"supreme\s+court|"
    r"district\s+court|"
    r"high\s+court|"
    r"court\s+of\s+appeal|"
    r"administrative\s+appeals\s+tribunal|"
    r"migration\s+review\s+tribunal|"
    r"refugee\s+review\s+tribunal|"
    r"\baata\b|"
    r"\barta\b|"
    r"\bvcat\b|"
    r"\bqcat\b|"
    r"\bncat\b",
    re.IGNORECASE,
)


@dataclass
class ExtractStats:
    method: str
    pages: int
    chars: int
    ocr_pages: int = 0


def _clean_line(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", (text or "").strip())
    # Some OCR engines output bullet markers as a single "e"/"o" at line start.
    cleaned = re.sub(r"^[\u2022\u2023\u2043\u2219\-*oOe]\s+", "", cleaned)
    return cleaned


def _read_native_pages(pdf_path: Path) -> list[str]:
    reader = PdfReader(str(pdf_path))
    return [(page.extract_text() or "").strip() for page in reader.pages]


def _format_pages(page_texts: list[str]) -> str:
    return "\n".join(
        f"=== PAGE {idx} ===\n{page_text}\n" for idx, page_text in enumerate(page_texts, start=1)
    ).strip()


def _read_native_text(pdf_path: Path) -> tuple[str, ExtractStats]:
    page_texts = _read_native_pages(pdf_path)
    text = _format_pages(page_texts)
    return text, ExtractStats(method="native", pages=len(page_texts), chars=len(text))


def _ocr_page(pdf_path: Path, page_num: int, dpi: int, lang: str) -> str:
    with tempfile.TemporaryDirectory() as tmpdir:
        prefix = Path(tmpdir) / "page"
        cmd = [
            "pdftoppm",
            "-f",
            str(page_num),
            "-l",
            str(page_num),
            "-r",
            str(dpi),
            "-png",
            str(pdf_path),
            str(prefix),
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        image = Path(f"{prefix}-{page_num:03d}.png")
        if not image.exists():
            pngs = sorted(Path(tmpdir).glob("*.png"))
            if not pngs:
                return ""
            image = pngs[0]
        tesseract_cmd = [
            "tesseract",
            str(image),
            "stdout",
            "-l",
            lang,
            "--psm",
            "6",
        ]
        result = subprocess.run(
            tesseract_cmd,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )
        return result.stdout.strip()


def _read_ocr_text(pdf_path: Path, dpi: int, lang: str) -> tuple[str, ExtractStats]:
    reader = PdfReader(str(pdf_path))
    total_pages = len(reader.pages)
    page_chunks: list[str] = []
    for page_num in range(1, total_pages + 1):
        ocr_text = _ocr_page(pdf_path, page_num, dpi=dpi, lang=lang)
        page_chunks.append(f"=== PAGE {page_num} ===\n{ocr_text}\n")
        if page_num % 25 == 0:
            print(f"[ocr] scanned {page_num}/{total_pages} pages")
    text = "\n".join(page_chunks).strip()
    return text, ExtractStats(method="ocr", pages=total_pages, chars=len(text), ocr_pages=total_pages)


def _page_needs_ocr(page_text: str, min_page_chars: int, min_alpha_ratio: float) -> bool:
    stripped = (page_text or "").strip()
    if len(stripped) < min_page_chars:
        return True
    alpha = sum(ch.isalpha() for ch in stripped)
    ratio = alpha / max(1, len(stripped))
    return ratio < min_alpha_ratio


def _is_judiciary_context(line: str, context: str) -> bool:
    line_low = line.lower()
    context_low = context.lower()
    if "justice of the peace" in context_low and "service to the judiciary" not in context_low:
        return False
    if not JUDICIARY_STRONG_CONTEXT_RE.search(context):
        return False
    # Avoid art/food/event judging false positives.
    if (
        "judge, " in context_low
        and not any(
            keyword in context_low
            for keyword in (
                "court",
                "tribunal",
                "service to the judiciary",
                "acting justice",
                "justice,",
            )
        )
    ):
        return False
    line_is_judicial_title = any(
        token in line_low for token in ("judge ", "justice ", "his honour", "honourable")
    )
    context_has_judicial_role = any(
        token in context_low
        for token in (
            " judge,",
            " justice,",
            "magistrate",
            "deputy president",
            "tribunal member",
            "member, administrative appeals tribunal",
        )
    )
    return line_is_judicial_title or context_has_judicial_role


def _extract_judiciary_names(full_text: str) -> list[str]:
    lines = [_clean_line(line) for line in full_text.splitlines()]
    candidates: list[str] = []
    for idx, line in enumerate(lines):
        if not line or not ENTRY_NAME_RE.match(line):
            continue
        context_lines: list[str] = []
        max_idx = min(len(lines), idx + 24)
        for probe in range(idx, max_idx):
            candidate_line = lines[probe]
            if probe > idx and ENTRY_NAME_RE.match(candidate_line):
                break
            context_lines.append(candidate_line)
        context = " ".join(context_lines)
        if not _is_judiciary_context(line, context):
            continue
        name_only = re.sub(r",\s*[A-Z]{2,4}.*$", "", line).strip()
        canonical_name = _strip_titles(name_only)
        if canonical_name:
            candidates.append(canonical_name)

    # Stable dedupe.
    seen: set[str] = set()
    output: list[str] = []
    for name in candidates:
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        output.append(name)
    return output


def _strip_titles(name: str) -> str:
    value = _clean_line(name)
    for _ in range(4):
        m = TITLE_PREFIX_RE.match(value)
        if not m:
            break
        value = value[m.end() :].strip()
    return value


def _surname_key(full_name: str) -> str:
    value = _strip_titles(full_name)
    parts = [p for p in re.split(r"\s+", value) if p]
    while parts and parts[-1].rstrip(".,").lower() in POSTNOMINALS:
        parts.pop()
    if not parts:
        return ""
    surname = re.sub(r"[^A-Za-z'\-]", "", parts[-1]).lower()
    if not re.fullmatch(r"[a-z][a-z'\-]{2,}", surname):
        return ""
    return surname


def _build_aliases(full_name: str) -> set[str]:
    aliases: set[str] = set()
    cleaned = _strip_titles(full_name)
    lowered = cleaned.lower()
    if lowered:
        aliases.add(lowered)
    words = [re.sub(r"[^A-Za-z'\-]", "", w).lower() for w in cleaned.split()]
    words = [w for w in words if w]
    if len(words) >= 2:
        aliases.add(f"{words[0]} {words[-1]}")
    surname = _surname_key(full_name)
    if surname:
        aliases.add(surname)
    return aliases


def _canonical_tokens(name: str) -> tuple[str, ...]:
    cleaned = _strip_titles(name)
    tokens = [re.sub(r"[^A-Za-z'\-]", "", part).lower() for part in cleaned.split()]
    tokens = [token for token in tokens if token]
    while tokens and tokens[-1] in POSTNOMINALS:
        tokens.pop()
    return tuple(tokens)


def _prefer_canonical_name(existing: str, candidate: str) -> str:
    """Prefer richer canonical label when two names are token-equivalent."""
    if _canonical_tokens(existing) != _canonical_tokens(candidate):
        return candidate
    existing_score = len(_strip_titles(existing).split())
    candidate_score = len(_strip_titles(candidate).split())
    return existing if existing_score >= candidate_score else candidate


def _load_override_payload(path: Path) -> dict:
    if not path.exists():
        return {"version": 1, "overrides": {}, "sources": [], "meta": {}}
    with open(path, encoding="utf-8") as fh:
        payload = json.load(fh)
    if isinstance(payload, dict) and isinstance(payload.get("overrides"), dict):
        return payload
    if isinstance(payload, dict):
        return {"version": 1, "overrides": payload, "sources": [], "meta": {}}
    return {"version": 1, "overrides": {}, "sources": [], "meta": {}}


def _merge_names_into_overrides(
    payload: dict, full_names: list[str]
) -> tuple[dict[str, str], dict[str, tuple[str, str]]]:
    overrides = payload.setdefault("overrides", {})
    added: dict[str, str] = {}
    conflicts: dict[str, tuple[str, str]] = {}
    for full_name in full_names:
        canonical = _clean_line(full_name)
        aliases = _build_aliases(canonical)
        preferred_canonical = canonical
        for alias in aliases:
            existing = overrides.get(alias)
            if not existing:
                continue
            preferred_canonical = _prefer_canonical_name(existing, preferred_canonical)

        for alias in aliases:
            if not alias:
                continue
            existing = overrides.get(alias)
            if existing and existing != preferred_canonical:
                if _canonical_tokens(existing) == _canonical_tokens(preferred_canonical):
                    # Equivalent name, keep richer canonical consistently.
                    overrides[alias] = preferred_canonical
                    continue
                conflicts.setdefault(alias, (existing, preferred_canonical))
                continue
            if not existing:
                overrides[alias] = preferred_canonical
                added[alias] = preferred_canonical
    return added, conflicts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", required=True, help="Source PDF path")
    parser.add_argument(
        "--text-output",
        help="Path to write extracted text (default: downloaded_cases/ocr/<stem>.txt)",
    )
    parser.add_argument(
        "--overrides",
        default=str(DEFAULT_OVERRIDES_PATH),
        help="Path to judge_name_overrides.json",
    )
    parser.add_argument("--dpi", type=int, default=220, help="OCR image DPI")
    parser.add_argument("--lang", default="eng", help="Tesseract language")
    parser.add_argument(
        "--min-native-chars",
        type=int,
        default=3000,
        help="If native extraction chars < this threshold, run OCR fallback",
    )
    parser.add_argument(
        "--force-ocr",
        action="store_true",
        help="Skip native extraction and force OCR",
    )
    parser.add_argument(
        "--page-ocr-fallback",
        action="store_true",
        help="OCR only low-quality pages when native extraction is mostly usable",
    )
    parser.add_argument(
        "--min-page-chars",
        type=int,
        default=120,
        help="Page text shorter than this uses OCR when --page-ocr-fallback is enabled",
    )
    parser.add_argument(
        "--min-alpha-ratio",
        type=float,
        default=0.25,
        help="Page alphabetic ratio below this uses OCR when --page-ocr-fallback is enabled",
    )
    parser.add_argument("--dry-run", action="store_true", help="Do not write files")
    args = parser.parse_args()

    pdf_path = Path(args.pdf).expanduser().resolve()
    if not pdf_path.exists():
        raise SystemExit(f"PDF not found: {pdf_path}")

    text_output = (
        Path(args.text_output).expanduser().resolve()
        if args.text_output
        else (DEFAULT_OCR_DIR / f"{pdf_path.stem}.txt").resolve()
    )
    overrides_path = Path(args.overrides).expanduser().resolve()

    native_page_texts: list[str] = []
    if not args.force_ocr:
        native_page_texts = _read_native_pages(pdf_path)
        text = _format_pages(native_page_texts)
        stats = ExtractStats(method="native", pages=len(native_page_texts), chars=len(text))
    else:
        text, stats = ("", ExtractStats(method="native-skip", pages=0, chars=0))

    needs_full_ocr = args.force_ocr or stats.chars < args.min_native_chars
    if needs_full_ocr:
        if shutil.which("tesseract") is None:
            raise SystemExit("tesseract not found; install it or rerun without --force-ocr.")
        if shutil.which("pdftoppm") is None:
            raise SystemExit("pdftoppm not found; install poppler.")
        print("[ocr] running OCR fallback...")
        text, stats = _read_ocr_text(pdf_path, dpi=args.dpi, lang=args.lang)
    elif args.page_ocr_fallback and native_page_texts:
        has_ocr_tools = shutil.which("tesseract") is not None and shutil.which("pdftoppm") is not None
        if has_ocr_tools:
            page_indexes = [
                idx
                for idx, page_text in enumerate(native_page_texts, start=1)
                if _page_needs_ocr(page_text, args.min_page_chars, args.min_alpha_ratio)
            ]
            if page_indexes:
                print(
                    f"[ocr] native text usable; OCR only low-quality pages ({len(page_indexes)}/{len(native_page_texts)})..."
                )
                for idx, page_num in enumerate(page_indexes, start=1):
                    native_page_texts[page_num - 1] = _ocr_page(
                        pdf_path, page_num=page_num, dpi=args.dpi, lang=args.lang
                    )
                    if idx % 25 == 0:
                        print(f"[ocr] rescanned {idx}/{len(page_indexes)} fallback pages")
                text = _format_pages(native_page_texts)
                stats = ExtractStats(
                    method="native+ocr-pages",
                    pages=len(native_page_texts),
                    chars=len(text),
                    ocr_pages=len(page_indexes),
                )
        else:
            print("[ocr] skipping page fallback (tesseract/pdftoppm not found)")

    names = _extract_judiciary_names(text)
    print(
        f"[extract] method={stats.method}, pages={stats.pages}, chars={stats.chars}, ocr_pages={stats.ocr_pages}"
    )
    print(f"[extract] judiciary name candidates={len(names)}")
    for name in names[:20]:
        print(f"  - {name}")

    payload = _load_override_payload(overrides_path)
    added, conflicts = _merge_names_into_overrides(payload, names)

    meta = payload.setdefault("meta", {})
    meta["from_pdf_last_source"] = str(pdf_path)
    meta["from_pdf_last_candidates"] = len(names)
    meta["from_pdf_last_added"] = len(added)
    meta["from_pdf_last_conflicts"] = len(conflicts)
    meta["total_overrides"] = len(payload.get("overrides", {}))

    if not args.dry_run:
        text_output.parent.mkdir(parents=True, exist_ok=True)
        text_output.write_text(text, encoding="utf-8")
        with open(overrides_path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        print(f"[write] extracted text -> {text_output}")
        print(f"[write] overrides updated -> {overrides_path}")
    else:
        print("[dry-run] no files written")

    if added:
        print("[overrides] added aliases:")
        for alias, full_name in sorted(added.items())[:80]:
            print(f"  {alias} => {full_name}")
        if len(added) > 80:
            print(f"  ... ({len(added) - 80} more)")

    if conflicts:
        print("[overrides] conflicts (kept existing):")
        for alias, (existing, candidate) in sorted(conflicts.items())[:40]:
            print(f"  {alias}: existing={existing!r}, candidate={candidate!r}")
        if len(conflicts) > 40:
            print(f"  ... ({len(conflicts) - 40} more)")


if __name__ == "__main__":
    main()
