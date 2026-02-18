"""
Shared Cloudflare configuration for all scraper scripts.

Configuration is loaded from environment variables or .env file.
Required: CF_ACCOUNT_ID, CF_API_TOKEN, WORKER_AUTH_TOKEN
Optional: WORKER_URL (auto-detected from account), R2_BUCKET_NAME
"""

import os
from pathlib import Path

# Try to load .env file from scripts/ directory
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip("'\"")
            if key and value:
                os.environ.setdefault(key, value)

# ─── Cloudflare Account ──────────────────────────────────────────────────────

CF_ACCOUNT_ID = os.environ.get("CF_ACCOUNT_ID", "")
CF_API_TOKEN = os.environ.get("CF_API_TOKEN", "")

# ─── Worker ───────────────────────────────────────────────────────────────────

WORKER_URL = os.environ.get(
    "WORKER_URL",
    "https://austlii-scraper.672rmwysbs.workers.dev",
)
WORKER_AUTH_TOKEN = os.environ.get("WORKER_AUTH_TOKEN", "")

# ─── R2 ──────────────────────────────────────────────────────────────────────

R2_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME", "austlii-case-results")

# S3-compatible endpoint for R2
R2_ENDPOINT = f"https://{CF_ACCOUNT_ID}.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "")

# ─── Local Paths ─────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "downloaded_cases"
CSV_PATH = DATA_DIR / "immigration_cases.csv"
JSON_PATH = DATA_DIR / "immigration_cases.json"
TEXT_DIR = DATA_DIR / "case_texts"


def validate_config(require_r2: bool = False) -> list[str]:
    """Validate that required config values are set. Returns list of errors."""
    errors = []

    if not WORKER_AUTH_TOKEN:
        errors.append("WORKER_AUTH_TOKEN not set")

    if require_r2:
        if not CF_ACCOUNT_ID:
            errors.append("CF_ACCOUNT_ID not set")
        if not R2_ACCESS_KEY_ID:
            errors.append("R2_ACCESS_KEY_ID not set")
        if not R2_SECRET_ACCESS_KEY:
            errors.append("R2_SECRET_ACCESS_KEY not set")

    return errors


def get_r2_client():
    """Get a boto3 S3 client configured for Cloudflare R2."""
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )
