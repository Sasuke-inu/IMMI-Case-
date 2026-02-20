"""Scraper for Australian legislation text from AustLII.

Fetches section-by-section text for Commonwealth immigration-related laws.
Inherits BaseScraper for rate limiting, retry logic, and browser-like headers.

AustLII legislation URL structure:
  TOC:     https://www.austlii.edu.au/au/legis/cth/consol_act/ma1958116/
  Section: https://www.austlii.edu.au/au/legis/cth/consol_act/ma1958116/s1.html
"""

import re
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag

from .base import BaseScraper

logger = logging.getLogger(__name__)

AUSTLII_LEGIS_BASE = "https://www.austlii.edu.au/au/legis/cth"

# Known Australian immigration-related laws with their AustLII paths.
# The numeric suffix in the path is the AustLII-assigned database number.
KNOWN_LAWS: dict[str, dict] = {
    "migration-act-1958": {
        "austlii_id": "consol_act/ma1958116",
        "title": "Migration Act 1958",
        "shortcode": "MA1958",
        "type": "Act",
        "jurisdiction": "Commonwealth",
        "description": (
            "The primary legislation governing migration to, from and within Australia. "
            "Establishes visa framework, deportation procedures, and rights of non-citizens."
        ),
    },
    "migration-regulations-1994": {
        "austlii_id": "consol_reg/mr1994227",
        "title": "Migration Regulations 1994",
        "shortcode": "MR1994",
        "type": "Regulation",
        "jurisdiction": "Commonwealth",
        "description": (
            "Subordinate legislation made under the Migration Act 1958. "
            "Sets out detailed criteria for visa applications and processing."
        ),
    },
    "australian-citizenship-act-2007": {
        "austlii_id": "consol_act/aca2007254",
        "title": "Australian Citizenship Act 2007",
        "shortcode": "ACA2007",
        "type": "Act",
        "jurisdiction": "Commonwealth",
        "description": (
            "Governs the acquisition, loss, and cessation of Australian citizenship. "
            "Establishes pathways to citizenship and criteria for maintaining citizenship status."
        ),
    },
    "australian-border-force-act-2015": {
        "austlii_id": "consol_act/abfa2015209",
        "title": "Australian Border Force Act 2015",
        "shortcode": "ABFA2015",
        "type": "Act",
        "jurisdiction": "Commonwealth",
        "description": (
            "Establishes the Australian Border Force (ABF) and its functions. "
            "Governs border enforcement, customs, and immigration compliance operations."
        ),
    },
    "administrative-review-tribunal-act-2024": {
        "austlii_id": "consol_act/arta2024319",
        "title": "Administrative Review Tribunal Act 2024",
        "shortcode": "ARTA2024",
        "type": "Act",
        "jurisdiction": "Commonwealth",
        "description": (
            "Establishes the Administrative Review Tribunal (ART), "
            "replacing the AAT from October 2024 for merits review of migration decisions."
        ),
    },
    "administrative-appeals-tribunal-act-1975": {
        "austlii_id": "consol_act/aata1975228",
        "title": "Administrative Appeals Tribunal Act 1975",
        "shortcode": "AATA1975",
        "type": "Act",
        "jurisdiction": "Commonwealth",
        "description": (
            "Historical legislation governing the Administrative Appeals Tribunal (AAT), "
            "predecessor to the ART (2000–2024). Relevant for older case law."
        ),
    },
}

# Type alias for progress callback
ProgressCallback = Callable[[str, int, int, str], None]


@dataclass
class SectionLink:
    """A section link parsed from a TOC page."""

    section_id: str  # e.g. "s1", "s501"
    url: str         # absolute URL to section page
    number: str      # e.g. "1", "501", "501A"
    title: str       # e.g. "Short title", "Character test"
    part: str = ""   # e.g. "Part 9—Deportation"
    division: str = ""  # e.g. "Division 2—Cancellation of visas"


class LegislationScraper(BaseScraper):
    """Scrapes Commonwealth legislation section-by-section from AustLII."""

    # ── Public API ────────────────────────────────────────────────────────

    def scrape_all(
        self,
        law_ids: list[str] | None = None,
        progress_callback: ProgressCallback | None = None,
    ) -> list[dict]:
        """Scrape all known laws (or a subset) and return structured dicts.

        Args:
            law_ids: Subset of IDs to scrape (keys of KNOWN_LAWS). None = all.
            progress_callback: Called as (law_id, current, total, section_id)
                               after each section is fetched.

        Returns:
            List of legislation dicts ready for JSON serialisation.
        """
        ids = law_ids or list(KNOWN_LAWS.keys())
        results = []
        for law_id in ids:
            logger.info(f"Scraping law: {law_id}")
            try:
                result = self.scrape_one(law_id, progress_callback=progress_callback)
                if result is not None:
                    results.append(result)
            except Exception as e:
                logger.error(f"Unexpected error scraping {law_id}: {e}")
        return results

    def scrape_one(
        self,
        law_id: str,
        progress_callback: ProgressCallback | None = None,
    ) -> dict | None:
        """Scrape a single law and return a structured dict.

        Args:
            law_id: Key from KNOWN_LAWS (e.g. 'migration-act-1958').
            progress_callback: Progress reporting callback.

        Returns:
            Legislation dict with sections, or None if TOC fetch fails.
        """
        if law_id not in KNOWN_LAWS:
            logger.error(f"Unknown law_id: {law_id}. Available: {list(KNOWN_LAWS)}")
            return None

        meta = KNOWN_LAWS[law_id]
        toc_url = f"{AUSTLII_LEGIS_BASE}/{meta['austlii_id']}/"

        logger.info(f"Fetching TOC: {toc_url}")
        response = self.fetch(toc_url)
        if not response:
            logger.error(f"Failed to fetch TOC for {law_id} at {toc_url}")
            return None

        section_links = self._parse_toc(response.text, toc_url)
        last_amended = self._parse_last_amended(response.text)

        sections = self._fetch_sections(law_id, section_links, progress_callback)

        return {
            "id": law_id,
            "title": meta["title"],
            "austlii_id": meta["austlii_id"],
            "shortcode": meta["shortcode"],
            "type": meta["type"],
            "jurisdiction": meta["jurisdiction"],
            "description": meta["description"],
            "sections_count": len(sections),
            "last_amended": last_amended,
            "last_scraped": datetime.now(timezone.utc).isoformat(),
            "sections": sections,
        }

    # ── TOC Parsing ───────────────────────────────────────────────────────

    def _parse_toc(self, html: str, base_url: str) -> list[SectionLink]:
        """Parse a TOC page and extract section links with part/division context.

        Walks through all elements in document order, tracking Part/Division
        headings so each section link can be annotated with its structural context.
        """
        soup = BeautifulSoup(html, "lxml")
        links: list[SectionLink] = []
        current_part = ""
        current_division = ""

        # AustLII wraps legislation TOC in a <div class="body"> or similar.
        # Fall back to the full body if not found.
        body = (
            soup.find("div", class_="body")
            or soup.find("div", id="content")
            or soup.find("div", id="textofelements")
            or soup.body
        )
        if not body:
            logger.warning(f"Could not find content container in TOC: {base_url}")
            return []

        for elem in body.descendants:
            # Skip bare text nodes (NavigableString) — we only want Tag elements
            if not isinstance(elem, Tag):
                continue

            tag = elem.name.lower() if elem.name else ""
            if not tag:
                continue

            # ── Track structural headings ────────────────────────────────
            if tag in ("h1", "h2", "h3", "h4", "b", "strong"):
                text = elem.get_text(" ", strip=True)
                text_clean = re.sub(r"\s+", " ", text).strip()

                if re.match(r"^Part\s+", text_clean, re.IGNORECASE):
                    current_part = text_clean
                    current_division = ""  # New Part resets Division
                elif re.match(r"^(Division|Subdivision)\s+", text_clean, re.IGNORECASE):
                    current_division = text_clean

            # ── Collect section links ────────────────────────────────────
            if tag != "a":
                continue

            raw_href = elem.get("href", "")
            # Normalise to str — BeautifulSoup can return AttributeValueList
            href = raw_href if isinstance(raw_href, str) else (raw_href[0] if raw_href else "")
            if not href:
                continue

            # Section pages end in s{digit}.html (e.g. s1.html, s501a.html)
            # Excludes schedules (sch1.html) by requiring digit after 's'
            m = re.match(r"(s\d[\w]*\.html)$", href, re.IGNORECASE)
            if not m:
                continue

            link_text = elem.get_text(" ", strip=True)
            # AustLII links look like "1  Short title" or "501  Character test"
            num_match = re.match(r"^([\d]+[A-Za-z]?)\s+(.*)", link_text)
            if num_match:
                number = num_match.group(1)
                title = num_match.group(2).strip()
            else:
                number = link_text
                title = ""

            section_id = m.group(1).replace(".html", "")
            full_url = href if href.startswith("http") else urljoin(base_url, href)

            # Avoid duplicate section IDs (some TOC pages link same section twice)
            if any(lk.section_id == section_id for lk in links):
                continue

            links.append(SectionLink(
                section_id=section_id,
                url=full_url,
                number=number,
                title=title,
                part=current_part,
                division=current_division,
            ))

        logger.info(f"Parsed {len(links)} section links from TOC")
        return links

    def _parse_last_amended(self, html: str) -> str:
        """Extract the last-amended date string from a TOC page.

        AustLII typically includes text like:
          "Series as amended to 1 December 2025"
          "Authoritative version as at 15 November 2025"
        """
        patterns = [
            r"as amended to[:\s]+(\d{1,2}\s+\w+\s+\d{4})",
            r"amended to[:\s]+(\d{1,2}\s+\w+\s+\d{4})",
            r"authoritative version as at[:\s]+(\d{1,2}\s+\w+\s+\d{4})",
            r"as at[:\s]+(\d{1,2}\s+\w+\s+\d{4})",
            r"updated[:\s]+(\d{4}-\d{2}-\d{2})",
        ]
        for pattern in patterns:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return ""

    # ── Section Fetching ──────────────────────────────────────────────────

    def _fetch_sections(
        self,
        law_id: str,
        section_links: list[SectionLink],
        progress_callback: ProgressCallback | None,
    ) -> list[dict]:
        """Fetch all section pages and return structured section dicts."""
        sections: list[dict] = []
        total = len(section_links)

        for i, link in enumerate(section_links):
            if progress_callback:
                progress_callback(law_id, i, total, link.section_id)

            response = self.fetch(link.url)
            if not response:
                logger.warning(f"Failed to fetch {link.section_id} ({link.url})")
                text = "[Section text could not be loaded]"
            else:
                text = self._extract_section_text(response.text)

            sections.append({
                "id": link.section_id,
                "number": link.number,
                "title": link.title,
                "part": link.part,
                "division": link.division,
                "text": text,
            })

        if progress_callback:
            progress_callback(law_id, total, total, "done")

        return sections

    def _extract_section_text(self, html: str) -> str:
        """Extract clean plain text from a section HTML page.

        AustLII section pages have the section text in a main content div.
        Removes navigation, headers, footers, and script/style elements.
        """
        soup = BeautifulSoup(html, "lxml")

        # Strip boilerplate elements
        for tag in soup.find_all(["nav", "header", "footer", "script", "style"]):
            tag.decompose()

        # Try progressively broader selectors for main content
        content = (
            soup.find("div", class_="body")
            or soup.find("div", class_="LegBody")
            or soup.find("div", class_="LegSection")
            or soup.find("div", id="content")
            or soup.find("article")
            or soup.find("main")
        )

        if content:
            # Unwrap internal anchor links (keep text, remove <a> wrapper)
            for anchor in content.find_all("a", href=re.compile(r"^#")):
                anchor.unwrap()
            text = content.get_text(separator="\n", strip=True)
        else:
            text = soup.get_text(separator="\n", strip=True)

        # Normalise whitespace: collapse 3+ consecutive blank lines to 2
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()
