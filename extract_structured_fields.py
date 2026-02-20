#!/usr/bin/env python3
"""
Extract structured fields from immigration case text files.

Extracts: applicant_name, respondent, country_of_origin,
visa_subclass_number, hearing_date, is_represented, representative

Usage:
    python extract_structured_fields.py                    # process all
    python extract_structured_fields.py --dry-run          # preview without saving
    python extract_structured_fields.py --sample 100       # process 100 random
    python extract_structured_fields.py --court ARTA       # only ARTA cases
"""

import argparse
import csv
import os
import re
import shutil
import sys
from collections import Counter
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

# ── Constants ────────────────────────────────────────────────────────────

CASES_DIR = Path("downloaded_cases/case_texts")
CSV_PATH = Path("downloaded_cases/immigration_cases.csv")

COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Angola", "Argentina", "Armenia",
    "Azerbaijan", "Bangladesh", "Belarus", "Bhutan", "Bolivia", "Bosnia",
    "Brazil", "Brunei", "Bulgaria", "Burma", "Burundi", "Cambodia",
    "Cameroon", "Central African Republic", "Chad", "Chile", "China",
    "Colombia", "Comoros", "Congo", "Croatia", "Cuba", "Czech Republic",
    "Djibouti", "Dominican Republic", "East Timor", "Ecuador", "Egypt",
    "El Salvador", "Eritrea", "Estonia", "Ethiopia", "Fiji", "France",
    "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Guatemala",
    "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary",
    "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
    "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya",
    "Kiribati", "Korea", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos",
    "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Lithuania",
    "Macedonia", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali",
    "Malta", "Mauritania", "Mauritius", "Mexico", "Moldova", "Mongolia",
    "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru",
    "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria",
    "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan",
    "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru",
    "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia",
    "Rwanda", "Samoa", "Saudi Arabia", "Senegal", "Serbia", "Sierra Leone",
    "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia",
    "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka",
    "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan",
    "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga",
    "Trinidad", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda",
    "Ukraine", "United Arab Emirates", "United Kingdom", "United States",
    "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Yemen",
    "Zambia", "Zimbabwe",
]

# Demonym → Country mapping for "X citizen" patterns
DEMONYMS = {
    "Afghan": "Afghanistan", "Albanian": "Albania", "Algerian": "Algeria",
    "Angolan": "Angola", "Argentine": "Argentina", "Armenian": "Armenia",
    "Azerbaijani": "Azerbaijan", "Bangladeshi": "Bangladesh",
    "Belarusian": "Belarus", "Bhutanese": "Bhutan", "Bolivian": "Bolivia",
    "Bosnian": "Bosnia", "Brazilian": "Brazil", "Bulgarian": "Bulgaria",
    "Burmese": "Myanmar", "Burundian": "Burundi", "Cambodian": "Cambodia",
    "Cameroonian": "Cameroon", "Chadian": "Chad", "Chilean": "Chile",
    "Chinese": "China", "Colombian": "Colombia", "Congolese": "Congo",
    "Croatian": "Croatia", "Cuban": "Cuba", "Czech": "Czech Republic",
    "Dominican": "Dominican Republic", "Ecuadorian": "Ecuador",
    "Egyptian": "Egypt", "Eritrean": "Eritrea", "Estonian": "Estonia",
    "Ethiopian": "Ethiopia", "Fijian": "Fiji", "French": "France",
    "Georgian": "Georgia", "German": "Germany", "Ghanaian": "Ghana",
    "Greek": "Greece", "Guatemalan": "Guatemala", "Guinean": "Guinea",
    "Guyanese": "Guyana", "Haitian": "Haiti", "Honduran": "Honduras",
    "Hungarian": "Hungary", "Indian": "India", "Indonesian": "Indonesia",
    "Iranian": "Iran", "Iraqi": "Iraq", "Irish": "Ireland",
    "Israeli": "Israel", "Italian": "Italy", "Jamaican": "Jamaica",
    "Japanese": "Japan", "Jordanian": "Jordan", "Kazakh": "Kazakhstan",
    "Kenyan": "Kenya", "Korean": "Korea", "Kosovar": "Kosovo",
    "Kuwaiti": "Kuwait", "Kyrgyz": "Kyrgyzstan", "Laotian": "Laos",
    "Latvian": "Latvia", "Lebanese": "Lebanon", "Liberian": "Liberia",
    "Libyan": "Libya", "Lithuanian": "Lithuania", "Macedonian": "Macedonia",
    "Malagasy": "Madagascar", "Malawian": "Malawi", "Malaysian": "Malaysia",
    "Maldivian": "Maldives", "Malian": "Mali", "Maltese": "Malta",
    "Mauritian": "Mauritius", "Mexican": "Mexico", "Moldovan": "Moldova",
    "Mongolian": "Mongolia", "Montenegrin": "Montenegro",
    "Moroccan": "Morocco", "Mozambican": "Mozambique",
    "Namibian": "Namibia", "Nauruan": "Nauru", "Nepalese": "Nepal",
    "Nepali": "Nepal", "Dutch": "Netherlands",
    "New Zealander": "New Zealand", "Nicaraguan": "Nicaragua",
    "Nigerian": "Nigeria", "Norwegian": "Norway", "Omani": "Oman",
    "Pakistani": "Pakistan", "Palestinian": "Palestine",
    "Panamanian": "Panama", "Papua New Guinean": "Papua New Guinea",
    "Paraguayan": "Paraguay", "Peruvian": "Peru", "Filipino": "Philippines",
    "Philippine": "Philippines", "Polish": "Poland",
    "Portuguese": "Portugal", "Qatari": "Qatar", "Romanian": "Romania",
    "Russian": "Russia", "Rwandan": "Rwanda", "Samoan": "Samoa",
    "Saudi": "Saudi Arabia", "Senegalese": "Senegal", "Serbian": "Serbia",
    "Sierra Leonean": "Sierra Leone", "Singaporean": "Singapore",
    "Slovak": "Slovakia", "Slovenian": "Slovenia",
    "Somali": "Somalia", "South African": "South Africa",
    "South Sudanese": "South Sudan", "Spanish": "Spain",
    "Sri Lankan": "Sri Lanka", "Sudanese": "Sudan",
    "Surinamese": "Suriname", "Swedish": "Sweden", "Swiss": "Switzerland",
    "Syrian": "Syria", "Taiwanese": "Taiwan", "Tajik": "Tajikistan",
    "Tanzanian": "Tanzania", "Thai": "Thailand",
    "Timorese": "Timor-Leste", "Togolese": "Togo", "Tongan": "Tonga",
    "Trinidadian": "Trinidad", "Tunisian": "Tunisia", "Turkish": "Turkey",
    "Turkmen": "Turkmenistan", "Tuvaluan": "Tuvalu", "Ugandan": "Uganda",
    "Ukrainian": "Ukraine", "Emirati": "United Arab Emirates",
    "British": "United Kingdom", "American": "United States",
    "Uruguayan": "Uruguay", "Uzbek": "Uzbekistan",
    "Venezuelan": "Venezuela", "Vietnamese": "Vietnam", "Yemeni": "Yemen",
    "Zambian": "Zambia", "Zimbabwean": "Zimbabwe",
}

# Build regex patterns
_countries_pattern = "|".join(re.escape(c) for c in sorted(COUNTRIES, key=len, reverse=True))
_demonyms_pattern = "|".join(re.escape(d) for d in sorted(DEMONYMS.keys(), key=len, reverse=True))

RE_CITIZEN_OF = re.compile(
    rf"(?:citizen|national|resident)\s+of\s+({_countries_pattern})",
    re.IGNORECASE,
)
RE_DEMONYM_CITIZEN = re.compile(
    rf"(?:an?\s+)?({_demonyms_pattern})\s+(?:citizen|national)",
    re.IGNORECASE,
)
RE_BORN_IN = re.compile(
    rf"born\s+in\s+({_countries_pattern})",
    re.IGNORECASE,
)
RE_FROM_COUNTRY = re.compile(
    rf"(?:arrived|came|fled|travelled|traveled)\s+(?:in\s+Australia\s+)?from\s+({_countries_pattern})",
    re.IGNORECASE,
)

RE_SUBCLASS = re.compile(r"[Ss]ubclass\s+(\d{3})")
RE_HEARING_DATE = re.compile(
    r"(?:heard|hearing)[^\n]{0,40}?(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})",
    re.IGNORECASE,
)
RE_HEARING_DATE2 = re.compile(
    r"Date\s+of\s+(?:hearing|hearing\s+and\s+decision)[:\s]+(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})",
    re.IGNORECASE,
)
RE_DATE_HEARD = re.compile(
    r"Date\s+heard\s*:?\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})",
    re.IGNORECASE,
)

# Title parsing
RE_TITLE_V = re.compile(r"^(.+?)\s+v\s+(.+?)(?:\s*\[\d{4}\]|\s*$)", re.IGNORECASE)
RE_TITLE_AND = re.compile(r"^(.+?)\s+and\s+(Minister.+?)(?:\s*\[\d{4}\]|\s*$)", re.IGNORECASE)
# AATA/ARTA style: "Surname (Migration) [2019] AATA 2398 (date)"
RE_TITLE_AATA = re.compile(r"^(.+?)\s+\((?:Migration|Refugee|Character|Citizenship)\)\s*\[", re.IGNORECASE)
# "X and Migration Agents Registration Authority" / "X and Secretary, Department..."
RE_TITLE_AND_ORG = re.compile(
    r"^(.+?)\s+and\s+((?:Migrations?\s+Agents?\s+Registration\s+Authority|"
    r"Secretary,?\s+Department.+?|Department\s+of.+?|Migration\s+Review\s+Tribunal|"
    r"Military\s+Rehabilitation.+?))(?:\s*\(|\s*\[\d{4}\]|\s*$)",
    re.IGNORECASE,
)
# "X; Secretary, Department..." (semicolon separator in FOI cases)
RE_TITLE_SEMICOLON = re.compile(
    r"^(.+?);\s*(Secretary,?\s+Department.+?)(?:\s+and\s*\(|\s*\[\d{4}\]|\s*$)",
    re.IGNORECASE,
)

# AATA structured preamble fields (name on next line after label)
RE_AATA_APPLICANT = re.compile(
    r"APPLICANT(?:\(S\))?:\s*\n\s*\n?\s*(.+?)(?:\s*CASE\s*NUMBER|\s*\n\s*\n)",
    re.IGNORECASE,
)
RE_AATA_REPRESENTATIVE = re.compile(
    r"(?:APPLICANT(?:'?S)?\s+REPRESENTATIVE|REPRESENTATIVE\s+FOR\s+(?:THE\s+)?APPLICANT)\s*:\s*\n\s*\n?\s*(.+?)(?:\s*\n\s*\n|\s*DECISION|\s*DATE)",
    re.IGNORECASE,
)

# "X national" pattern (e.g., "Indian national", "a Sri Lankan national")
RE_DEMONYM_NATIONAL = re.compile(
    rf"(?:an?\s+)?({_demonyms_pattern})\s+(?:national|citizen|born)",
    re.IGNORECASE,
)

# Representation patterns
RE_SELF_REP = re.compile(
    r"(?:self[- ]represented|appeared?\s+(?:in\s+person|on\s+(?:his|her|their)\s+own\s+behalf)|unrepresented|without\s+representation)",
    re.IGNORECASE,
)
RE_REP_BY = re.compile(
    r"(?:represented\s+by|Counsel\s+for\s+the\s+Applicant)\s*:?\s*(.+?)(?:\n|,\s*instructed|$)",
    re.IGNORECASE,
)
RE_APPLICANT_REP = re.compile(
    r"Applicant(?:'s)?\s+Representative\s*:?\s*\n?\s*(.+?)(?:\n|$)",
    re.IGNORECASE,
)
# FCA/FCCA multiline format: "Counsel for the Appellant:\nMr X Solicitor for the Appellant:"
RE_FCA_COUNSEL_APPELLANT = re.compile(
    r"(?:Counsel|Solicitor)\s+for\s+(?:the\s+)?(?:Appellant|Applicant)s?:?\s*\n\s*"
    r"([^\n]{3,80}?)(?:\s+(?:Solicitor|Counsel|Appearing)\s+for\s+the\s+|\s*\n|$)",
    re.IGNORECASE,
)
# "For the Appellant: Mr Smith" pattern
RE_FOR_APPELLANT = re.compile(
    r"^For\s+(?:the\s+)?(?:Appellant|Applicant)s?:?\s+(.{3,80}?)(?:\n|$)",
    re.IGNORECASE | re.MULTILINE,
)
# "Migration Agent: [name]" label (MRTA/AATA cases)
RE_MIGRATION_AGENT = re.compile(
    r"(?:Migration\s+Agent|Registered\s+Migration\s+Agent)\s*:\s*\n?\s*(.+?)(?:\n|$)",
    re.IGNORECASE,
)
# "appeared/appearing for the applicant: name"
RE_APPEARED_FOR = re.compile(
    r"(?:appeared?|appearing)\s+(?:on\s+behalf\s+of|for)\s+(?:the\s+)?(?:appellant|applicant)s?"
    r"[:\s]+([A-Z][^\n]{2,60}?)(?:\n|$)",
    re.IGNORECASE,
)

# Country of Reference label (RRTA structured header)
RE_COUNTRY_REF = re.compile(
    r"Country\s+of\s+(?:Reference|Origin|Citizenship)\s*:\s*\n?\s*(.+?)(?:\n|$)",
    re.IGNORECASE,
)
# Nationality label
RE_NATIONALITY_LABEL = re.compile(
    r"Nationality\s*:\s*\n?\s*(.+?)(?:\n|$)",
    re.IGNORECASE,
)
# "People's Republic of China" alias
RE_PRC = re.compile(
    r"(?:People'?s?\s+Republic\s+of\s+China|P\.R\.C\.?)\b",
    re.IGNORECASE,
)


# ── Extraction Functions ─────────────────────────────────────────────────


def extract_from_title(title: str) -> tuple[str, str]:
    """Extract applicant_name and respondent from case title."""
    if not title:
        return "", ""

    # Try "X v Y" pattern first (FCA, FCCA, HCA style)
    m = RE_TITLE_V.match(title.strip())
    if m:
        return m.group(1).strip(), m.group(2).strip()

    # Try "X and Minister..." pattern (AATA, ARTA style)
    m = RE_TITLE_AND.match(title.strip())
    if m:
        return m.group(1).strip(), m.group(2).strip()

    # Try "X and [Organization]" (MARA, Secretary, Department, etc.)
    m = RE_TITLE_AND_ORG.match(title.strip())
    if m:
        return m.group(1).strip(), m.group(2).strip()

    # Try "X; Secretary, Department..." (FOI cases with semicolon)
    m = RE_TITLE_SEMICOLON.match(title.strip())
    if m:
        return m.group(1).strip(), m.group(2).strip()

    # Try "Surname (Migration/Refugee)" pattern (AATA surname-only)
    m = RE_TITLE_AATA.match(title.strip())
    if m:
        name = m.group(1).strip()
        # Skip anonymous numeric IDs (e.g. "1606474")
        if not name.replace(" ", "").isdigit():
            return name, ""

    # Last resort: handle "Xv Minister" (no space before v) — rare typo
    m = re.match(r"^(.+?)v\s+(Minister.+?)(?:\s*\[\d{4}\]|\s*$)", title.strip(), re.IGNORECASE)
    if m:
        return m.group(1).strip(), m.group(2).strip()

    return "", ""


def _demonym_to_country(demonym: str) -> str:
    """Resolve a demonym string to its country name."""
    for key, country in DEMONYMS.items():
        if key.lower() == demonym.lower():
            return country
    return ""


def extract_country(text: str) -> str:
    """Extract country of origin from case text."""
    # Try structured "Country of Reference:" label first (RRTA, most reliable)
    m = RE_COUNTRY_REF.search(text[:3000])
    if m:
        val = m.group(1).strip()
        for c in COUNTRIES:
            if c.lower() == val.lower():
                return c
        # Try demonym fallback
        country = _demonym_to_country(val)
        if country:
            return country
        if val:
            return val  # Return as-is if not in list (e.g. "Iran, Islamic Republic of")

    # Try "Nationality: [value]" label
    m = RE_NATIONALITY_LABEL.search(text[:3000])
    if m:
        val = m.group(1).strip().rstrip(".,")
        for c in COUNTRIES:
            if c.lower() == val.lower():
                return c
        country = _demonym_to_country(val)
        if country:
            return country

    # People's Republic of China → China
    if RE_PRC.search(text[:8000]):
        return "China"

    # Try "citizen/national of [Country]" first (most reliable)
    m = RE_CITIZEN_OF.search(text)
    if m:
        return m.group(1)

    # Try "[Demonym] citizen/national" (e.g. "an Indian citizen")
    m = RE_DEMONYM_CITIZEN.search(text)
    if m:
        result = _demonym_to_country(m.group(1))
        if result:
            return result

    # Try "[Demonym] national/born" (e.g. "Indian national", "Sri Lankan born")
    m = RE_DEMONYM_NATIONAL.search(text)
    if m:
        result = _demonym_to_country(m.group(1))
        if result:
            return result

    # Try "born in [Country]"
    m = RE_BORN_IN.search(text)
    if m:
        return m.group(1)

    # Try "arrived/fled from [Country]"
    m = RE_FROM_COUNTRY.search(text)
    if m:
        return m.group(1)

    # Try "the applicant is from [Country]" or "applicant from [Country]"
    m = re.search(
        rf"(?:the\s+)?applicant\s+(?:is\s+)?(?:a\s+)?(?:from|of)\s+({_countries_pattern})",
        text, re.IGNORECASE,
    )
    if m:
        return m.group(1)

    # Try "from [Country]" near "applicant" (within 200 chars)
    for match in re.finditer(r"applicant", text[:8000], re.IGNORECASE):
        chunk = text[match.start():match.start() + 200]
        m = re.search(rf"from\s+({_countries_pattern})\b", chunk, re.IGNORECASE)
        if m and m.group(1) != "Australia":
            return m.group(1)

    # Try "[Country] passport" (not "their/valid passport")
    m = re.search(rf"({_countries_pattern})\s+passport", text[:8000], re.IGNORECASE)
    if m:
        return m.group(1)

    # Skip AustLII navigation bar — find body text after separator line
    _SKIP_COUNTRIES = {"Australia", "New Zealand"}
    body_start = text.find("=" * 20)
    body = text[body_start + 80:] if body_start > 0 else text[500:]  # skip separator + nav

    # Try "fear of persecution/harm in [Country]" or "return to [Country]"
    m = re.search(
        rf"(?:persecution|harm|return(?:ed)?|refoul)\s+(?:in|to)\s+({_countries_pattern})",
        body[:8000], re.IGNORECASE,
    )
    if m and m.group(1) not in _SKIP_COUNTRIES:
        return m.group(1)

    # Last resort: first non-AU/NZ country mentioned in text body
    for m in re.finditer(rf"\b({_countries_pattern})\b", body[:5000], re.IGNORECASE):
        country = m.group(1)
        if country not in _SKIP_COUNTRIES:
            return country

    return ""


def extract_visa_subclass_number(text: str, existing_subclass: str, visa_type: str = "") -> str:
    """Extract visa subclass number (3-digit) from text or existing fields."""
    # First try existing visa_subclass field
    if existing_subclass:
        m = re.search(r"(\d{3})", existing_subclass)
        if m:
            return m.group(1)

    # Try visa_type field (e.g. "Protection visa (subclass 866)")
    if visa_type:
        m = re.search(r"(?:subclass|Subclass)\s+(\d{3})", visa_type)
        if m:
            return m.group(1)

    # Search in text
    if text:
        m = RE_SUBCLASS.search(text)
        if m:
            return m.group(1)

    return ""


_MONTHS = r"(?:January|February|March|April|May|June|July|August|September|October|November|December)"
RE_AATA_DATE = re.compile(
    rf"DATE\s*:\s*\n\s*\n?\s*(\d{{1,2}}\s+{_MONTHS}\s+\d{{4}})",
    re.IGNORECASE,
)
RE_STATEMENT_MADE = re.compile(
    rf"Statement\s+made\s+on\s+(\d{{1,2}}\s+{_MONTHS}\s+\d{{4}})",
    re.IGNORECASE,
)
RE_DECISION_ON = re.compile(
    rf"(?:decision|decided|delivered|handed\s+down)\s+(?:on\s+)?(\d{{1,2}}\s+{_MONTHS}\s+\d{{4}})",
    re.IGNORECASE,
)
# Fallback: "Date of judgment: DD Month YYYY" or "Judgment of: ... Date of judgment: ..."
RE_JUDGMENT_DATE = re.compile(
    rf"Date\s+of\s+(?:judgment|decision|orders?)\s*:\s*\n?\s*(\d{{1,2}}\s+{_MONTHS}\s+\d{{4}})",
    re.IGNORECASE,
)
# Fallback: "Judgment: DD Month YYYY" on its own line
RE_JUDGMENT_LINE = re.compile(
    rf"(?:^|\n)\s*(?:Judgment|Decision|Delivered\s+on)\s*:\s*\n?\s*(\d{{1,2}}\s+{_MONTHS}\s+\d{{4}})",
    re.IGNORECASE,
)


def extract_hearing_date(text: str) -> str:
    """Extract hearing date from case text."""
    if not text:
        return ""

    # Try "Date of hearing: [date]" first (most explicit)
    m = RE_HEARING_DATE2.search(text)
    if m:
        return m.group(1)

    # Try "heard/hearing ... [date]"
    m = RE_HEARING_DATE.search(text)
    if m:
        return m.group(1)

    # Try AATA structured "DATE:\n\nDD Month YYYY" field
    m = RE_AATA_DATE.search(text[:3000])
    if m:
        return m.group(1)

    # Try "Statement made on DD Month YYYY"
    m = RE_STATEMENT_MADE.search(text[:5000])
    if m:
        return m.group(1)

    # Try "decision on / delivered DD Month YYYY"
    m = RE_DECISION_ON.search(text[:5000])
    if m:
        return m.group(1)

    # Fallback: "Date of judgment/decision: DD Month YYYY"
    m = RE_JUDGMENT_DATE.search(text[:5000])
    if m:
        return m.group(1)

    # Fallback: "Judgment: DD Month YYYY" on its own
    m = RE_JUDGMENT_LINE.search(text[:5000])
    if m:
        return m.group(1)

    # Fallback: "Date heard: DD Month YYYY"
    m = RE_DATE_HEARD.search(text[:5000])
    if m:
        return m.group(1)

    return ""


def extract_representation(text: str) -> tuple[str, str]:
    """Extract representation info. Returns (is_represented, representative)."""
    # Extend to 8000 chars — FCA appearance sections can be deeper in document
    preamble = text[:8000]

    # Check for explicit self-representation
    if RE_SELF_REP.search(preamble):
        # Could also have a representative mentioned elsewhere
        m = RE_REP_BY.search(preamble)
        if m:
            rep_name = m.group(1).strip()
            if rep_name.lower() not in ("the applicant is self-represented", "self-represented", ""):
                return "Yes", rep_name
        return "No", ""

    # Check for "Applicant's Representative: [name]"
    m = RE_APPLICANT_REP.search(preamble)
    if m:
        rep_name = m.group(1).strip()
        if re.search(r"self[- ]represented|nil|none|n/a", rep_name, re.IGNORECASE):
            return "No", ""
        return "Yes", rep_name

    # Check for "represented by [name]"
    m = RE_REP_BY.search(preamble)
    if m:
        rep_name = m.group(1).strip()
        if rep_name.lower() not in ("the applicant is self-represented", "self-represented", ""):
            return "Yes", rep_name

    # FCA/FCCA multiline: "Counsel for the Appellant:\nMr X Solicitor for the..."
    m = RE_FCA_COUNSEL_APPELLANT.search(preamble)
    if m:
        rep_name = m.group(1).strip()
        # Strip any trailing label fragment that crept in
        rep_name = re.sub(r"\s+(?:Solicitor|Counsel|Appearing)\s+.*$", "", rep_name, flags=re.IGNORECASE).strip()
        if rep_name and len(rep_name) > 2 and not re.search(r"self[- ]represented|nil|none|n/a", rep_name, re.IGNORECASE):
            return "Yes", rep_name

    # "For the Appellant: Mr Smith" pattern
    m = RE_FOR_APPELLANT.search(preamble)
    if m:
        rep_name = m.group(1).strip()
        if rep_name and len(rep_name) > 2:
            return "Yes", rep_name

    # Migration Agent label (MRTA/AATA cases)
    m = RE_MIGRATION_AGENT.search(preamble)
    if m:
        agent = m.group(1).strip()
        if agent and not re.search(r"nil|none|n/a|unrepresented", agent, re.IGNORECASE):
            return "Yes", agent

    # "appeared for the applicant: name" pattern
    m = RE_APPEARED_FOR.search(preamble)
    if m:
        rep_name = m.group(1).strip()
        if rep_name and len(rep_name) > 2:
            return "Yes", rep_name

    return "", ""


def process_case(case_row: dict) -> dict:
    """Process a single case and extract all structured fields."""
    title = case_row.get("title", "")
    citation = case_row.get("citation", "")
    visa_subclass = case_row.get("visa_subclass", "")
    visa_type = case_row.get("visa_type", "")

    # Extract from title
    applicant_name, respondent = extract_from_title(title)

    # Read full text file if available
    text = ""
    text_path = case_row.get("full_text_path", "")
    if text_path and os.path.exists(text_path):
        try:
            with open(text_path, "r", encoding="utf-8", errors="replace") as f:
                text = f.read()
        except (OSError, IOError):
            pass

    # Also try constructing path from citation
    if not text and citation:
        constructed_path = CASES_DIR / f"{citation}.txt"
        if constructed_path.exists():
            try:
                text = constructed_path.read_text(encoding="utf-8", errors="replace")
            except (OSError, IOError):
                pass

    # Extract from text
    country = extract_country(text) if text else ""
    visa_num = extract_visa_subclass_number(text, visa_subclass, visa_type)
    hearing_date = extract_hearing_date(text) if text else ""
    is_represented, representative = extract_representation(text) if text else ("", "")

    # If no applicant from title, try structured fields in text
    if not applicant_name and text:
        preamble = text[:3000]
        # Try MRTA structured "REVIEW APPLICANT: Name" format (same-line or next-line)
        m = re.search(r"REVIEW\s+APPLICANT\s*:\s*\n?\s*([^\n]{2,80}?)(?:\n|$)", preamble, re.IGNORECASE)
        if m:
            name = m.group(1).strip()
            name = re.sub(r"\s*(?:CASE\s*NUMBER|FILE\s*NUMBER|DIBP\s*REF|PRESIDING|TRIBUNAL|MRT).*$", "", name, flags=re.IGNORECASE).strip()
            if name and not name.replace(" ", "").isdigit() and len(name) > 1:
                applicant_name = name
        # Try AATA structured "APPLICANT:\n\nName CASE NUMBER:" format
        m = RE_AATA_APPLICANT.search(preamble)
        if m and not applicant_name:
            name = m.group(1).strip()
            # Clean trailing "CASE NUMBER:" fragment
            name = re.sub(r"\s*CASE\s*NUMBER.*$", "", name, flags=re.IGNORECASE).strip()
            if name and not name.replace(" ", "").isdigit():
                applicant_name = name
        # Fallback: inline "Applicant: Name" on same line
        if not applicant_name:
            m = re.search(r"Applicant/?s?\s*:\s*(.+?)(?:\n|$)", preamble, re.IGNORECASE)
            if m:
                name = m.group(1).strip()
                # Clean trailing "CASE NUMBER:" or "File Number:" fragment
                name = re.sub(r"\s*(?:CASE\s*NUMBER|FILE\s*NUMBER|DIBP\s*REF).*$", "", name, flags=re.IGNORECASE).strip()
                # Skip if it's just a label fragment
                if name and len(name) > 2 and not name.replace(" ", "").isdigit():
                    applicant_name = name

    # If no respondent from title, try "Respondent:" field in text
    if not respondent and text:
        m = re.search(r"Respondent\s*:\s*(.+?)(?:\n|$)", text[:3000], re.IGNORECASE)
        if m:
            respondent = m.group(1).strip()

    # If no representative found, try AATA structured representative field
    if not representative and text:
        m = RE_AATA_REPRESENTATIVE.search(text[:5000])
        if m:
            rep_name = m.group(1).strip()
            if rep_name and not re.search(r"self[- ]represented|nil|none|n/a", rep_name, re.IGNORECASE):
                is_represented = "Yes"
                representative = rep_name
            elif re.search(r"self[- ]represented|nil|none|n/a", rep_name, re.IGNORECASE):
                is_represented = "No"

    return {
        "applicant_name": applicant_name,
        "respondent": respondent,
        "country_of_origin": country,
        "visa_subclass_number": visa_num,
        "hearing_date": hearing_date,
        "is_represented": is_represented,
        "representative": representative,
    }


# ── Main ─────────────────────────────────────────────────────────────────


def load_csv() -> list[dict]:
    """Load the immigration cases CSV."""
    if not CSV_PATH.exists():
        print(f"Error: {CSV_PATH} not found")
        sys.exit(1)

    with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        return list(reader)


def save_csv(rows: list[dict]):
    """Save updated rows back to CSV with atomic write."""
    if not rows:
        return

    # Backup first
    backup_path = CSV_PATH.with_suffix(".csv.bak_extract")
    shutil.copy2(CSV_PATH, backup_path)
    print(f"Backup saved to {backup_path}")

    fieldnames = list(rows[0].keys())

    tmp_path = CSV_PATH.with_suffix(".csv.tmp")
    with open(tmp_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    os.replace(str(tmp_path), str(CSV_PATH))
    print(f"Saved {len(rows)} rows to {CSV_PATH}")


def main():
    parser = argparse.ArgumentParser(description="Extract structured fields from case texts")
    parser.add_argument("--dry-run", action="store_true", help="Preview without saving")
    parser.add_argument("--sample", type=int, default=0, help="Process N random cases")
    parser.add_argument("--court", type=str, default="", help="Filter by court code")
    parser.add_argument("--workers", type=int, default=8, help="Number of parallel workers")
    args = parser.parse_args()

    all_rows = load_csv()
    print(f"Loaded {len(all_rows)} cases from CSV")

    # Determine which rows to process vs. save
    rows = all_rows

    # Filter
    if args.court:
        rows = [r for r in rows if r.get("court_code", "") == args.court]
        print(f"Filtered to {len(rows)} {args.court} cases")

    # Sample (only affects which rows to process, not what gets saved)
    if args.sample > 0:
        import random
        rows = random.sample(rows, min(args.sample, len(rows)))
        print(f"Sampled {len(rows)} cases")

    # Ensure new columns exist
    new_fields = [
        "applicant_name", "respondent", "country_of_origin",
        "visa_subclass_number", "hearing_date", "is_represented", "representative",
    ]
    for row in rows:
        for field in new_fields:
            if field not in row:
                row[field] = ""

    # Process cases
    stats = Counter()
    total = len(rows)

    print(f"Processing {total} cases with {args.workers} workers...")

    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        for completed, (row, extracted) in enumerate(
            zip(rows, executor.map(process_case, rows, chunksize=500))
        ):
            for field, value in extracted.items():
                if value:
                    # Don't overwrite existing values — only fill empty fields
                    if not row.get(field):
                        row[field] = value
                        stats[f"{field}_extracted"] += 1
                    else:
                        stats["skipped_existing"] += 1

            if (completed + 1) % 5000 == 0:
                print(f"  Processed {completed + 1}/{total}...")

    # Summary
    print(f"\n{'='*60}")
    print("Extraction Summary")
    print(f"{'='*60}")
    print(f"Total processed: {total}")
    print(f"Skipped (existing): {stats.get('skipped_existing', 0)}")
    print()
    for field in new_fields:
        key = f"{field}_extracted"
        count = stats.get(key, 0)
        pct = (count / total * 100) if total > 0 else 0
        print(f"  {field:25s}: {count:>6,} ({pct:5.1f}%)")

    if args.dry_run:
        print("\nDry run — no changes saved.")
        # Show some samples
        print("\nSample extractions:")
        samples = [r for r in rows if r.get("applicant_name")][:5]
        for s in samples:
            print(f"  {s.get('citation', '?'):30s} | {s.get('applicant_name', ''):20s} | {s.get('country_of_origin', ''):20s} | SC{s.get('visa_subclass_number', ''):>3s} | {s.get('is_represented', '')}")
    else:
        # Reload full CSV to merge (in case we filtered/sampled)
        if args.court or args.sample:
            all_rows = load_csv()
            # Ensure new columns in all rows
            for row in all_rows:
                for f in new_fields:
                    if f not in row:
                        row[f] = ""
            # Build lookup by case_id
            extracted_map = {r["case_id"]: r for r in rows if r.get("case_id")}
            for row in all_rows:
                cid = row.get("case_id", "")
                if cid in extracted_map:
                    src = extracted_map[cid]
                    for f in new_fields:
                        if src.get(f) and not row.get(f):
                            row[f] = src[f]
            save_csv(all_rows)
        else:
            save_csv(rows)


if __name__ == "__main__":
    main()
