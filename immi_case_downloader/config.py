"""Configuration constants for immigration case downloading."""

from datetime import datetime

# Date range: last 10 years
CURRENT_YEAR = datetime.now().year
START_YEAR = CURRENT_YEAR - 10
END_YEAR = CURRENT_YEAR

# AustLII base URLs
AUSTLII_BASE = "https://www.austlii.edu.au"
AUSTLII_SEARCH = f"{AUSTLII_BASE}/cgi-bin/sinosrch.cgi"

# Court/Tribunal database paths on AustLII
AUSTLII_DATABASES = {
    "AATA": {
        "name": "Administrative Appeals Tribunal",
        "path": "/au/cases/cth/AATA/",
        "description": "AAT migration & refugee review decisions",
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
        "name": "Federal Circuit and Family Court (Div 2)",
        "path": "/au/cases/cth/FedCFamC2G/",
        "description": "Federal Circuit and Family Court General Division immigration cases",
    },
    "HCA": {
        "name": "High Court of Australia",
        "path": "/au/cases/cth/HCA/",
        "description": "High Court immigration appeals",
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
REQUEST_TIMEOUT = 30
REQUEST_DELAY = 1.0  # seconds between requests (be respectful)
MAX_RETRIES = 3
USER_AGENT = (
    "IMMI-Case-Downloader/1.0 (Legal Research; "
    "https://github.com/Sasuke-inu/IMMI-Case-)"
)

# Output settings
OUTPUT_DIR = "downloaded_cases"
CASES_CSV = "immigration_cases.csv"
CASES_JSON = "immigration_cases.json"
RAW_CASES_DIR = "raw_html"
TEXT_CASES_DIR = "case_texts"
