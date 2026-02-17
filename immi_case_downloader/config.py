"""Configuration constants for immigration case downloading.

All settings can be overridden via environment variables prefixed with IMMI_.
"""

import os
from datetime import datetime

# Date range: last 10 years
CURRENT_YEAR = datetime.now().year


def _safe_int(val, default: int) -> int:
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def _safe_float(val, default: float) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


START_YEAR = _safe_int(os.environ.get("IMMI_START_YEAR"), CURRENT_YEAR - 10)
END_YEAR = _safe_int(os.environ.get("IMMI_END_YEAR"), CURRENT_YEAR)

# AustLII base URLs
AUSTLII_BASE = "https://www.austlii.edu.au"
AUSTLII_SEARCH = f"{AUSTLII_BASE}/cgi-bin/sinosrch.cgi"

# Court/Tribunal database paths on AustLII
AUSTLII_DATABASES = {
    "AATA": {
        "name": "Administrative Appeals Tribunal",
        "path": "/au/cases/cth/AATA/",
        "description": "AAT migration & refugee review decisions (ended Oct 2024)",
    },
    "ARTA": {
        "name": "Administrative Review Tribunal",
        "path": "/au/cases/cth/ARTA/",
        "description": "ART migration & refugee review decisions (replaced AAT from Oct 2024)",
    },
    "FCA": {
        "name": "Federal Court of Australia",
        "path": "/au/cases/cth/FCA/",
        "description": "Federal Court immigration judicial review",
    },
    "FCCA": {
        "name": "Federal Circuit Court of Australia",
        "path": "/au/cases/cth/FCCA/",
        "description": "Federal Circuit Court immigration cases",
    },
    "FedCFamC2G": {
        "name": "Federal Circuit and Family Court of Australia (Division 2)",
        "path": "/au/cases/cth/FedCFamC2G/",
        "description": "Federal Circuit and Family Court General Division immigration cases",
    },
    "HCA": {
        "name": "High Court of Australia",
        "path": "/au/cases/cth/HCA/",
        "description": "High Court immigration appeals",
    },
    "FMCA": {
        "name": "Federal Magistrates Court of Australia",
        "path": "/au/cases/cth/FMCA/",
        "description": "Federal Magistrates Court immigration cases (2000-2013, predecessor to FCCA)",
    },
    "RRTA": {
        "name": "Refugee Review Tribunal",
        "path": "/au/cases/cth/RRTA/",
        "description": "Refugee Review Tribunal decisions (pre-2015)",
    },
    "MRTA": {
        "name": "Migration Review Tribunal",
        "path": "/au/cases/cth/MRTA/",
        "description": "Migration Review Tribunal decisions (pre-2015)",
    },
}

# Federal Court judgments search
FEDERAL_COURT_SEARCH = "https://search2.fedcourt.gov.au/s/search.html"

# Immigration-related search keywords
IMMIGRATION_KEYWORDS = [
    "Minister for Immigration",
    "Department of Home Affairs",
    "Migration Act",
    "protection visa",
    "migration",
    "visa cancellation",
    "visa refusal",
    "deportation order",
    "bridging visa",
    "refugee",
    "character test",
    "section 501",
]

# Request settings
REQUEST_TIMEOUT = _safe_int(os.environ.get("IMMI_TIMEOUT"), 30)
REQUEST_DELAY = _safe_float(os.environ.get("IMMI_DELAY"), 1.0)
MAX_RETRIES = _safe_int(os.environ.get("IMMI_MAX_RETRIES"), 3)
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

# Output settings
OUTPUT_DIR = os.environ.get("IMMI_OUTPUT_DIR", "downloaded_cases")
CASES_CSV = "immigration_cases.csv"
CASES_JSON = "immigration_cases.json"
RAW_CASES_DIR = "raw_html"
TEXT_CASES_DIR = "case_texts"
