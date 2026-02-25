#!/usr/bin/env python3
"""Fetch and download judge profile images one-by-one, then update judge_bios.json.

This script prioritizes professional/public sources and writes local files to:
  downloaded_cases/judge_photos/<judge-key>.jpg

It updates each matching entry in downloaded_cases/judge_bios.json with:
  photo_url: "/api/v1/judge-photo/<judge-key>.jpg"
  photo_source_url: "<direct image url>"
  photo_source_page: "<page where image was discovered>"
  photo_fetched_at: "<UTC ISO timestamp>"

Usage:
  python3 scripts/fetch_judge_profile_images.py
  python3 scripts/fetch_judge_profile_images.py --limit 20
  python3 scripts/fetch_judge_profile_images.py --refresh-existing
  python3 scripts/fetch_judge_profile_images.py --names "street, emmett"
"""

from __future__ import annotations

import argparse
import base64
import json
import re
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BIOS_PATH = ROOT / "downloaded_cases" / "judge_bios.json"
PHOTO_DIR = ROOT / "downloaded_cases" / "judge_photos"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

TITLE_PREFIX_RE = re.compile(
    r"^(?:The\s+Hon(?:ourable)?\.?\s+|Hon(?:ourable)?\.?\s+|"
    r"Chief\s+Justice\s+|Chief\s+Judge\s+|Justice\s+|Judge\s+|"
    r"Senior\s+Member\s+|Deputy\s+President\s+|Deputy\s+Member\s+|"
    r"Deputy\s+|Principal\s+Member\s+|Member\s+|Magistrate\s+|"
    r"President\s+|Registrar\s+|Mr\.?\s+|Mrs\.?\s+|Ms\.?\s+|Miss\s+|"
    r"Dr\.?\s+|Prof\.?\s+)",
    re.IGNORECASE,
)
TITLE_WORDS = {
    "the",
    "honourable",
    "honorable",
    "judge",
    "justice",
    "chief",
    "member",
    "senior",
    "deputy",
    "president",
    "principal",
    "registrar",
    "mr",
    "mrs",
    "ms",
    "miss",
    "dr",
    "prof",
}
POSTNOMINALS = {
    "ac",
    "ao",
    "am",
    "kc",
    "qc",
    "sc",
    "oam",
    "psm",
    "csc",
}

BAD_IMAGE_HINTS = {
    "logo",
    "icon",
    "sprite",
    "banner",
    "favicon",
    "placeholder",
    "advert",
    "ads",
    "emoji",
    "thumbnail-default",
    "social-media-image",
    "social%20media%20image",
    "solid.png",
    "default.jpg",
    "default.png",
    "coas-stacked",
    "media-exp",
    "/dms/image/",
}

BLOCKED_RESULT_DOMAINS = {
    "youtube.com",
    "youtu.be",
    "pinterest.com",
    "instagram.com",
    "facebook.com",
    "tiktok.com",
}

DOMAIN_WEIGHTS = {
    "fcfcoa.gov.au": 12,
    "fedcourt.gov.au": 12,
    "highcourt.gov.au": 11,
    "art.gov.au": 11,
    "aat.gov.au": 10,
    "directory.gov.au": 10,
    "aph.gov.au": 9,
    "parliament.nsw.gov.au": 8,
    "nswbar.asn.au": 8,
    "lawcouncil.asn.au": 7,
    "wikipedia.org": 6,
    "linkedin.com": 5,
}

TRUSTED_HOST_SUFFIXES = (".gov.au", ".edu.au", ".asn.au", ".org.au")
TRUSTED_HOSTS = {
    "wikipedia.org",
    "en.wikipedia.org",
    "linkedin.com",
    "au.linkedin.com",
    "www.linkedin.com",
}

NEWS_HOSTS = {
    "afr.com",
    "theguardian.com",
    "abc.net.au",
    "sbs.com.au",
    "lawyersweekly.com.au",
    "miragenews.com",
    "themandarin.com.au",
    "australianlawyer.com.au",
    "qlsproctor.com.au",
    "greekherald.com.au",
}


@dataclass(slots=True)
class ImageCandidate:
    image_url: str
    page_url: str
    score: int
    name_hits: int
    source: str
    query: str


def _load_bios(path: Path) -> dict[str, dict]:
    with open(path, encoding="utf-8") as fh:
        payload = json.load(fh)
    if not isinstance(payload, dict):
        raise ValueError("judge_bios.json must be a JSON object")
    clean: dict[str, dict] = {}
    for key, value in payload.items():
        if isinstance(key, str) and isinstance(value, dict):
            clean[key] = value
    return clean


def _save_bios(path: Path, bios: dict[str, dict]) -> None:
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(bios, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    tmp.replace(path)


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "unknown"


def _strip_titles(full_name: str) -> str:
    value = re.sub(r"\s+", " ", (full_name or "").strip())
    for _ in range(4):
        m = TITLE_PREFIX_RE.match(value)
        if not m:
            break
        value = value[m.end() :].strip()
    parts = [p for p in value.split() if p]
    while parts and parts[-1].rstrip(".,").lower() in POSTNOMINALS:
        parts.pop()
    return " ".join(parts).strip() or full_name.strip()


def _name_tokens(value: str) -> list[str]:
    text = re.sub(r"[^A-Za-z\s'-]", " ", value or "")
    tokens = [t.lower() for t in text.split() if t.strip()]
    return [t for t in tokens if t not in TITLE_WORDS]


def _domain_weight(url: str) -> int:
    host = urlparse(url).netloc.lower()
    for domain, score in DOMAIN_WEIGHTS.items():
        if host == domain or host.endswith(f".{domain}"):
            return score
    if host.endswith(".gov.au"):
        return 8
    return 2


def _decode_bing_redirect(href: str) -> str | None:
    parsed = urlparse(href)
    if "bing.com" not in parsed.netloc:
        return href if href.startswith("http") else None
    query = parse_qs(parsed.query)
    encoded = query.get("u", [None])[0]
    if not encoded:
        return None
    # Bing uses a1<base64-url>
    if encoded.startswith("a1"):
        encoded = encoded[2:]
    pad = "=" * (-len(encoded) % 4)
    try:
        decoded = base64.urlsafe_b64decode((encoded + pad).encode("ascii")).decode(
            "utf-8", errors="ignore"
        )
    except Exception:
        return None
    return decoded if decoded.startswith("http") else None


def _blocked_domain(url: str) -> bool:
    host = urlparse(url).netloc.lower()
    return any(host == d or host.endswith(f".{d}") for d in BLOCKED_RESULT_DOMAINS)


def _looks_bad_image_url(url: str) -> bool:
    low = url.lower()
    return any(token in low for token in BAD_IMAGE_HINTS)


def _name_match_score(text: str, tokens: list[str]) -> int:
    low = text.lower()
    if not tokens:
        return 0
    score = 0
    surname = tokens[-1]
    if surname and surname in low:
        score += 4
    for token in tokens[:-1]:
        if len(token) >= 4 and token in low:
            score += 2
    return score


def _name_hits(text: str, tokens: list[str]) -> int:
    low = text.lower()
    hits = 0
    for token in tokens:
        if len(token) >= 4 and token in low:
            hits += 1
    return hits


def _fetch_html(session: requests.Session, url: str) -> tuple[str | None, str]:
    try:
        resp = session.get(url, timeout=18, allow_redirects=True)
    except requests.RequestException:
        return None, url
    ctype = resp.headers.get("content-type", "").lower()
    if resp.status_code >= 400 or "text/html" not in ctype:
        return None, resp.url
    return resp.text, resp.url


def _extract_html_candidates(
    html_text: str,
    page_url: str,
    tokens: list[str],
    query: str,
) -> list[ImageCandidate]:
    soup = BeautifulSoup(html_text, "html.parser")
    out: list[ImageCandidate] = []

    def add_candidate(raw_url: str | None, base_score: int, source: str, context: str = "") -> None:
        if not raw_url:
            return
        image_url = urljoin(page_url, raw_url.strip())
        if not image_url.startswith(("http://", "https://")):
            return
        low_image = image_url.lower()
        if low_image.endswith(".svg") or ".svg?" in low_image:
            return
        if _looks_bad_image_url(image_url):
            return
        score = base_score + _domain_weight(page_url)
        combined = " ".join(filter(None, [image_url, page_url, context]))
        name_hits = _name_hits(combined, tokens)
        score += _name_match_score(combined, tokens)
        out.append(
            ImageCandidate(
                image_url=image_url,
                page_url=page_url,
                score=score,
                name_hits=name_hits,
                source=source,
                query=query,
            )
        )

    for tag, attrs in (
        ("meta", {"property": "og:image"}),
        ("meta", {"name": "twitter:image"}),
        ("meta", {"property": "twitter:image"}),
        ("meta", {"name": "image"}),
    ):
        node = soup.find(tag, attrs=attrs)
        add_candidate(node.get("content") if node else None, 14, "meta")

    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or img.get("data-original")
        if not src or src.startswith("data:"):
            continue
        alt = " ".join(
            filter(
                None,
                [
                    img.get("alt"),
                    img.get("title"),
                    " ".join(img.get("class") or []),
                ],
            )
        )
        base = 6
        alt_low = alt.lower()
        if any(k in alt_low for k in ("judge", "justice", "member", "profile", "portrait", "headshot")):
            base += 4
        add_candidate(src, base, "img", alt)

    # Higher score first, dedupe by image URL.
    dedup: dict[str, ImageCandidate] = {}
    for cand in sorted(out, key=lambda c: c.score, reverse=True):
        dedup.setdefault(cand.image_url, cand)
    return list(dedup.values())


def _search_bing_web(session: requests.Session, query: str, limit: int = 10) -> list[str]:
    try:
        resp = session.get(
            "https://www.bing.com/search",
            params={"q": query},
            timeout=18,
        )
    except requests.RequestException:
        return []
    if resp.status_code >= 400:
        return []
    soup = BeautifulSoup(resp.text, "html.parser")
    urls: list[str] = []
    for item in soup.select("li.b_algo a[href]"):
        raw = item.get("href", "").strip()
        if not raw:
            continue
        decoded = _decode_bing_redirect(raw) or raw
        if not decoded.startswith(("http://", "https://")):
            continue
        if _blocked_domain(decoded):
            continue
        urls.append(decoded)
        if len(urls) >= limit:
            break
    # Keep order, dedupe.
    seen: set[str] = set()
    out: list[str] = []
    for url in urls:
        if url in seen:
            continue
        seen.add(url)
        out.append(url)
    return out


def _search_bing_images(
    session: requests.Session,
    query: str,
    tokens: list[str],
    limit: int = 25,
) -> list[ImageCandidate]:
    try:
        resp = session.get(
            "https://www.bing.com/images/search",
            params={"q": query, "form": "HDRSC2"},
            timeout=18,
        )
    except requests.RequestException:
        return []
    if resp.status_code >= 400:
        return []
    soup = BeautifulSoup(resp.text, "html.parser")
    out: list[ImageCandidate] = []
    for node in soup.select("a.iusc"):
        raw_m = node.get("m")
        if not raw_m:
            continue
        try:
            payload = json.loads(raw_m)
        except json.JSONDecodeError:
            continue
        image_url = (payload.get("murl") or "").strip()
        page_url = (payload.get("purl") or "").strip()
        if not image_url.startswith(("http://", "https://")):
            continue
        if page_url and _blocked_domain(page_url):
            continue
        if _looks_bad_image_url(image_url):
            continue
        text = " ".join(filter(None, [page_url, node.get("title"), payload.get("surl")]))
        combined = " ".join(filter(None, [text, image_url]))
        name_hits = _name_hits(combined, tokens)
        score = 5 + _name_match_score(combined, tokens)
        if page_url:
            score += _domain_weight(page_url)
        out.append(
            ImageCandidate(
                image_url=image_url,
                page_url=page_url or image_url,
                score=score,
                name_hits=name_hits,
                source="bing-images",
                query=query,
            )
        )
        if len(out) >= limit:
            break

    dedup: dict[str, ImageCandidate] = {}
    for cand in sorted(out, key=lambda c: c.score, reverse=True):
        dedup.setdefault(cand.image_url, cand)
    return list(dedup.values())


def _download_image_as_jpeg(
    session: requests.Session,
    image_url: str,
    out_file: Path,
) -> bool:
    try:
        resp = session.get(image_url, timeout=20, stream=True, allow_redirects=True)
    except requests.RequestException:
        return False
    if resp.status_code >= 400:
        return False
    ctype = resp.headers.get("content-type", "").lower()
    if "image" not in ctype:
        return False
    if "svg" in ctype:
        return False

    raw = resp.content
    if len(raw) < 5_000 or len(raw) > 12_000_000:
        return False

    try:
        image = Image.open(BytesIO(raw))
        image.load()
    except Exception:
        return False

    width, height = image.size
    if width < 140 or height < 140:
        return False
    ratio = width / height
    # Prefer portrait/square profile images over wide banners.
    if ratio > 1.45 or ratio < 0.55:
        return False

    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")
    elif image.mode == "L":
        image = image.convert("RGB")

    out_file.parent.mkdir(parents=True, exist_ok=True)
    image.save(out_file, format="JPEG", quality=90, optimize=True)
    return True


def _build_queries(name: str) -> list[str]:
    clean = _strip_titles(name)
    return [
        f"\"{clean}\" Australian judge profile",
        f"\"{clean}\" \"Federal Circuit and Family Court\"",
        f"\"{clean}\" \"Federal Court\" judge",
        f"\"{clean}\" \"Administrative Review Tribunal\" member",
    ]


def _candidate_matches_person(cand: ImageCandidate, tokens: list[str]) -> bool:
    if not tokens:
        return False
    haystack = f"{cand.image_url} {cand.page_url}".lower()
    surname = tokens[-1]
    if surname not in haystack:
        return False
    context_words = ("judge", "justice", "member", "tribunal", "court", "judicial")
    if cand.name_hits >= 2:
        if any(word in haystack for word in context_words):
            return True
        if _domain_weight(cand.page_url) >= 10:
            return True
    if cand.source in {"img", "meta"} and any(
        word in haystack for word in ("judge", "justice", "member", "profile", "portrait")
    ):
        return True
    return False


def _is_trusted_page(page_url: str, *, allow_news_domains: bool) -> bool:
    host = urlparse(page_url).netloc.lower()
    if not host:
        return False
    if host in TRUSTED_HOSTS:
        return True
    if host.endswith(TRUSTED_HOST_SUFFIXES):
        return True
    if allow_news_domains:
        if host in NEWS_HOSTS:
            return True
        if any(host.endswith(f".{d}") for d in NEWS_HOSTS):
            return True
    return False


def _iter_targets(
    bios: dict[str, dict],
    *,
    refresh_existing: bool,
    names: set[str] | None,
) -> Iterable[tuple[str, dict]]:
    for key, entry in bios.items():
        if names and key.lower() not in names:
            continue
        has_photo = bool(str(entry.get("photo_url") or "").strip())
        if has_photo and not refresh_existing:
            continue
        yield key, entry


def main() -> None:
    parser = argparse.ArgumentParser(description="Download judge profile images.")
    parser.add_argument("--bios", type=Path, default=BIOS_PATH, help=f"Path to judge_bios.json (default: {BIOS_PATH})")
    parser.add_argument("--photos-dir", type=Path, default=PHOTO_DIR, help=f"Directory for downloaded photos (default: {PHOTO_DIR})")
    parser.add_argument("--limit", type=int, default=0, help="Max judges to process (0 = all)")
    parser.add_argument("--sleep-seconds", type=float, default=0.6, help="Delay between judges to avoid rate limits")
    parser.add_argument("--refresh-existing", action="store_true", help="Re-fetch photos even if photo_url already exists")
    parser.add_argument("--dry-run", action="store_true", help="Do not write files; only print planned matches")
    parser.add_argument(
        "--use-bing-images",
        action="store_true",
        help="Enable direct Bing image-search fallback (lower precision).",
    )
    parser.add_argument(
        "--allow-news-domains",
        action="store_true",
        help="Allow major news domains as trusted sources (higher coverage, lower precision).",
    )
    parser.add_argument(
        "--names",
        default="",
        help="Comma-separated judge keys to process (e.g. 'street, emmett')",
    )
    args = parser.parse_args()

    bios = _load_bios(args.bios)
    selected_names = {
        n.strip().lower()
        for n in args.names.split(",")
        if n.strip()
    } or None

    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"}
    session = requests.Session()
    session.headers.update(headers)

    total = 0
    found = 0
    skipped = 0
    failed = 0

    targets = list(
        _iter_targets(
            bios,
            refresh_existing=args.refresh_existing,
            names=selected_names,
        )
    )
    if args.limit > 0:
        targets = targets[: args.limit]

    print(f"Processing judges: {len(targets)}")

    for idx, (key, entry) in enumerate(targets, start=1):
        total += 1
        display_name = str(entry.get("full_name") or key).strip() or key
        print(f"\n[{idx}/{len(targets)}] {key} ({display_name})")

        queries = _build_queries(display_name)
        source_url = str(entry.get("source_url") or "").strip()

        page_urls: list[str] = []
        if source_url.startswith(("http://", "https://")):
            page_urls.append(source_url)

        for query in queries:
            page_urls.extend(_search_bing_web(session, query))

        # Deduplicate page URLs.
        seen_pages: set[str] = set()
        dedup_pages: list[str] = []
        for url in page_urls:
            if url in seen_pages:
                continue
            seen_pages.add(url)
            dedup_pages.append(url)

        tokens = _name_tokens(display_name)
        candidates: list[ImageCandidate] = []

        if args.use_bing_images:
            for query in queries:
                # Optional fallback: lower precision than page-based extraction.
                candidates.extend(_search_bing_images(session, query, tokens))

        for page_url in dedup_pages[:15]:
            html_text, final_url = _fetch_html(session, page_url)
            if not html_text:
                continue
            candidates.extend(_extract_html_candidates(html_text, final_url, tokens, query=page_url))

        # Highest score first, dedupe by direct image URL.
        uniq: dict[str, ImageCandidate] = {}
        for cand in sorted(candidates, key=lambda c: c.score, reverse=True):
            uniq.setdefault(cand.image_url, cand)
        ranked = list(uniq.values())

        if not ranked:
            print("  - No candidate images found")
            failed += 1
            time.sleep(args.sleep_seconds)
            continue

        out_name = f"{_slugify(key)}.jpg"
        out_file = args.photos_dir / out_name
        chosen: ImageCandidate | None = None

        for cand in ranked[:30]:
            if cand.name_hits < 1:
                continue
            if cand.score < 10:
                continue
            if not _candidate_matches_person(cand, tokens):
                continue
            if not _is_trusted_page(
                cand.page_url, allow_news_domains=args.allow_news_domains
            ):
                continue
            if args.dry_run:
                chosen = cand
                break
            if _download_image_as_jpeg(session, cand.image_url, out_file):
                chosen = cand
                break

        if not chosen:
            print("  - Candidates tried, but no valid image downloaded")
            failed += 1
            time.sleep(args.sleep_seconds)
            continue

        print(
            f"  - Selected ({chosen.source}, score={chosen.score}, hits={chosen.name_hits}): "
            f"{chosen.image_url[:120]}"
        )

        if not args.dry_run:
            entry["photo_url"] = f"/api/v1/judge-photo/{out_name}"
            entry["photo_source_url"] = chosen.image_url
            entry["photo_source_page"] = chosen.page_url
            entry["photo_lookup_query"] = chosen.query
            entry["photo_fetched_at"] = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
            found += 1
        else:
            skipped += 1

        time.sleep(args.sleep_seconds)

    if not args.dry_run:
        _save_bios(args.bios, bios)

    print("\nDone.")
    print(f"  processed: {total}")
    print(f"  updated:   {found}")
    print(f"  dry-run:   {skipped}")
    print(f"  failed:    {failed}")


if __name__ == "__main__":
    main()
