# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Australian immigration court/tribunal case downloader and manager. Scrapes case metadata and full text from AustLII and Federal Court, stores as CSV/JSON, and provides a Flask web interface for browsing, editing, and exporting.

## Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run tests
pip install -r requirements-test.txt
python3 -m pytest                       # all tests with coverage
python3 -m pytest tests/test_models.py  # models only
python3 -m pytest -x                    # stop on first failure

# CLI - search for cases
python run.py search
python run.py search --databases AATA FCA --start-year 2020 --end-year 2025
python run.py download --courts FCA --limit 50
python run.py list-databases

# Web interface
python web.py                    # http://localhost:5000
python web.py --port 8080 --debug

# Run as module
python -m immi_case_downloader search

# Bulk download full text (resumable, saves every 200)
python download_fulltext.py              # delay=0.5, ~2 cases/sec
```

## Architecture

```
run.py              → CLI entry point → immi_case_downloader.cli.main()
web.py              → Web entry point → immi_case_downloader.webapp.create_app()
postprocess.py      → Post-download field extraction (regex + LLM sub-agents)

immi_case_downloader/
  models.py         → ImmigrationCase dataclass (20 fields, SHA-256 ID generation)
  config.py         → Constants: AustLII URLs, court database definitions, keywords, rate limits
  storage.py        → CSV/JSON persistence (pandas), CRUD helpers for web UI
  webapp.py         → Flask app with background threading for search/download jobs
  cli.py            → argparse CLI with search/download/list-databases subcommands
  sources/
    base.py         → BaseScraper: requests.Session with retry, rate limiting
    austlii.py      → AustLIIScraper: browse year listings + keyword search fallback
    federal_court.py→ FederalCourtScraper: search2.fedcourt.gov.au with pagination
  templates/        → 11 Jinja2 templates (base.html + pages)
  static/style.css  → Single CSS file
```

### Key Design Patterns

- **Scraper hierarchy**: `BaseScraper` handles HTTP session, rate limiting (default 1s delay), and retry logic. `AustLIIScraper` and `FederalCourtScraper` inherit and implement `search_cases()` + `download_case_detail()`.
- **Two-phase data collection**: Stage 1 (search) populates basic metadata from listing pages. Stage 2 (download) extracts detailed fields (judges, catchwords, outcome, visa type) from full case text via regex.
- **Flat file storage**: All data persists in `downloaded_cases/immigration_cases.csv` and `.json`. No database. CRUD operations in `storage.py` reload/rewrite the entire CSV each time.
- **Background jobs**: Web search/download runs in daemon threads with a global `_job_status` dict for progress tracking. Only one job at a time.
- **Case identification**: `case_id` is first 12 chars of SHA-256 hash of citation/URL/title.

### Data Flow

1. Scraper fetches listing pages → parses HTML with BeautifulSoup/lxml → creates `ImmigrationCase` objects
2. Cases deduplicated by URL across sources
3. `storage.save_cases_csv/json()` persists via pandas DataFrame
4. Web UI reads from CSV via `load_all_cases()`, filters/sorts in memory
5. Download phase fetches individual case pages → extracts metadata via regex → saves full text to `downloaded_cases/case_texts/`

## Data Sources

| Code | Source | URL Pattern |
|------|--------|-------------|
| AATA, ARTA, FCA, FCCA, FedCFamC2G, HCA, RRTA, MRTA | AustLII | `austlii.edu.au/au/cases/cth/{code}/{year}/` |
| fedcourt | Federal Court | `search2.fedcourt.gov.au/s/search.html` |

- **AustLII viewdb URL**: `austlii.edu.au/cgi-bin/viewdb/au/cases/cth/{DB}/` — reliable year index page
- **AATA ended Oct 2024**: replaced by ART (Administrative Review Tribunal), database code ARTA
- **ARTA**: ART decisions from Oct 2024 onwards; 3,656+ cases; same URL/title format as AATA
- **AATA 2025-2026**: direct listing returns 500; only ~10 cases via viewdb fallback (use ARTA for 2025+)
- **FCCA ended 2021**: replaced by FedCFamC2G (Federal Circuit and Family Court restructure)

## Gotchas

- **`cmd_search` merge logic** — now merges by URL dedup; `max_results` defaults to 500/db (use large value for full crawl)
- **`config.py START_YEAR`** — dynamic (`CURRENT_YEAR - 10`); use `--start-year` flag to override
- **pandas NaN** — empty CSV fields become `float('nan')`; always use `ImmigrationCase.from_dict()`
- **Federal Court DNS** — `search2.fedcourt.gov.au` doesn't resolve; all FCA data via AustLII
- **RRTA/MRTA** — return 0 results (pre-2015 tribunals merged into AATA)
- **AATA vs ARTA** — AATA covers up to Oct 2024; ARTA covers Oct 2024 onwards. For 2025+ use ARTA
- **Port 5000** — conflicts with macOS AirPlay; use `--port 8080`
- **AustLII timeouts** — common during bulk scraping; retry logic in BaseScraper handles most

## Important Notes

- `downloaded_cases/` is gitignored — all scraped data is local only
- Rate limiting is enforced at the `BaseScraper` level; respect the default 1-second delay
- Test suite: 71 tests in `tests/` (models, storage, cli, webapp) — run `python3 -m pytest`
- The webapp uses a hardcoded `secret_key` in `webapp.py:46` — should be replaced via `SECRET_KEY` env var in production
