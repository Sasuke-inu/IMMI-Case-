# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Australian immigration court/tribunal case downloader and manager. Scrapes case metadata and full text from AustLII, stores as CSV/JSON (or Supabase/SQLite), and provides both a **Flask API** and a **React SPA** for browsing, editing, and exporting.

## Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run tests
pip install -r requirements-test.txt
python3 -m pytest                           # all tests (296 unit + 181 E2E)
python3 -m pytest tests/test_models.py      # models only
python3 -m pytest tests/e2e/react/ -x       # React E2E only
python3 -m pytest -x                        # stop on first failure

# CLI - search for cases
python run.py search
python run.py search --databases AATA FCA --start-year 2020 --end-year 2025
python run.py download --courts FCA --limit 50
python run.py list-databases

# Web interface (React SPA at /app/, Legacy Jinja2 at /)
python web.py --port 8080                   # http://localhost:8080/app/

# React frontend development
cd frontend && npm run dev                  # Vite dev server (HMR)
cd frontend && npm run build                # Production build → static/react/

# Bulk download full text (resumable, saves every 200)
python download_fulltext.py

# LLM-based field extraction (case_nature, legal_concepts)
python extract_llm_fields.py               # uses Claude Sonnet, batched
python merge_llm_results.py                 # merge batch results into CSV
```

## Architecture

```
run.py                → CLI entry point → immi_case_downloader.cli.main()
web.py                → Web entry point → immi_case_downloader.webapp.create_app()
postprocess.py        → Post-download field extraction (regex + LLM sub-agents)
download_fulltext.py  → Bulk full-text downloader (resumable, saves every 200)

immi_case_downloader/
  models.py           → ImmigrationCase dataclass (22 fields, SHA-256 ID generation)
  config.py           → Constants: AustLII URLs, court database definitions, keywords
  storage.py          → CSV/JSON persistence (pandas), CRUD helpers
  repository.py       → CaseRepository Protocol (runtime_checkable)
  csv_repository.py   → Wraps storage.py for backward compat
  sqlite_repository.py→ SQLite+FTS5+WAL, thread-local connections
  supabase_repository.py → Supabase (PostgreSQL) backend, 15 methods, native FTS
  pipeline.py         → SmartPipeline: 3-phase auto-fallback (crawl → clean → download)
  cli.py              → argparse CLI with search/download/list-databases subcommands
  web/
    __init__.py       → Flask factory with API blueprint + SPA catch-all at /app/
    helpers.py        → get_repo(), safe_int(), safe_float(), EDITABLE_FIELDS
    jobs.py           → 4 background job runners with repo param
    security.py       → CSRF config
    routes/
      api.py          → /api/v1/* JSON endpoints (22 endpoints) for React SPA
      dashboard.py    → Legacy Jinja2 dashboard
      cases.py        → Legacy Jinja2 case CRUD
      search.py       → Legacy Jinja2 search
      export.py       → CSV/JSON export
      pipeline_routes.py → Pipeline actions
      update_db.py    → Legacy update DB
  sources/
    base.py           → BaseScraper: requests.Session with retry, rate limiting
    austlii.py        → AustLIIScraper: browse year listings + keyword search fallback
    federal_court.py  → FederalCourtScraper: search2.fedcourt.gov.au with pagination
  templates/          → 14 Jinja2 templates (legacy, accessible at original routes)
  static/
    style.css         → Legacy CSS
    react/            → Vite build output (served by Flask at /app/)

frontend/             → React SPA (Vite 6 + React 18 + TypeScript + Tailwind v4)
  src/
    pages/            → 11 pages (Dashboard, Cases CRUD, Compare, Download, Pipeline, etc.)
    components/       → Shared (Breadcrumb, CourtBadge, ConfirmModal, etc.) + layout
    hooks/            → TanStack Query hooks (use-cases, use-stats, use-theme, use-keyboard)
    lib/api.ts        → CSRF-aware fetch wrapper for all API calls
    tokens/           → Design tokens JSON → CSS + TS build pipeline
  scripts/build-tokens.ts → Token pipeline: JSON → CSS + TS
```

### Key Design Patterns

- **Dual UI**: React SPA at `/app/` + legacy Jinja2 at `/`. API at `/api/v1/*`.
- **CaseRepository Protocol**: Abstracts storage backend. CSV (default), SQLite (FTS5+WAL), Supabase (PostgreSQL).
- **Scraper hierarchy**: `BaseScraper` handles HTTP session, rate limiting (1s delay), retry. `AustLIIScraper` and `FederalCourtScraper` inherit.
- **Two-phase data collection**: Stage 1 (search) populates basic metadata. Stage 2 (download) extracts detailed fields via regex.
- **Background jobs**: Daemon threads with `_job_status` dict for progress tracking. One job at a time.
- **Smart Pipeline**: 3-phase workflow (crawl → clean → download) with auto-fallback strategies.
- **Case identification**: `case_id` = first 12 chars of SHA-256 hash of citation/URL/title.

### Data Flow

1. Scraper fetches listing pages → parses HTML with BeautifulSoup/lxml → creates `ImmigrationCase` objects
2. Cases deduplicated by URL across sources
3. Repository persists via CSV, SQLite, or Supabase
4. React SPA reads from `/api/v1/*` endpoints, filters/sorts on backend
5. Download phase fetches individual case pages → extracts metadata via regex → saves full text

## Data Sources

| Code | Source | URL Pattern | Years |
|------|--------|-------------|-------|
| AATA | AustLII | `austlii.edu.au/au/cases/cth/AATA/{year}/` | 2000-2024 |
| ARTA | AustLII | `austlii.edu.au/au/cases/cth/ARTA/{year}/` | 2024+ |
| FCA | AustLII | `austlii.edu.au/au/cases/cth/FCA/{year}/` | 2000+ |
| FMCA | AustLII | `austlii.edu.au/au/cases/cth/FMCA/{year}/` | 2000-2013 |
| FCCA | AustLII | `austlii.edu.au/au/cases/cth/FCCA/{year}/` | 2013-2021 |
| FedCFamC2G | AustLII | `austlii.edu.au/au/cases/cth/FedCFamC2G/{year}/` | 2021+ |
| HCA | AustLII | `austlii.edu.au/au/cases/cth/HCA/{year}/` | 2000+ |
| RRTA | AustLII | `austlii.edu.au/au/cases/cth/RRTA/{year}/` | 2000-2015 |
| MRTA | AustLII | `austlii.edu.au/au/cases/cth/MRTA/{year}/` | 2000-2015 |
| fedcourt | Federal Court | `search2.fedcourt.gov.au/s/search.html` | (DNS broken) |

### Court Lineage

- **Lower court**: FMCA (2000-2013) → FCCA (2013-2021) → FedCFamC2G (2021+)
- **Tribunal**: RRTA + MRTA (pre-2015) → AATA (2015-2024) → ARTA (2024+)
- **AATA 2025-2026**: direct listing returns 500; use ARTA for 2025+
- **RRTA/MRTA/ARTA**: `IMMIGRATION_ONLY_DBS` — all cases are immigration-related, keyword filter skipped

## Gotchas

- **`cmd_search` merge logic** — merges by URL dedup; `max_results` defaults to 500/db
- **`config.py START_YEAR`** — dynamic (`CURRENT_YEAR - 10`); use `--start-year` flag to override
- **pandas NaN** — empty CSV fields become `float('nan')`; always use `ImmigrationCase.from_dict()`
- **Federal Court DNS** — `search2.fedcourt.gov.au` doesn't resolve; all FCA data via AustLII
- **RRTA/MRTA** — case titles use anonymized IDs (e.g. `N00/12345`), not keywords; `IMMIGRATION_ONLY_DBS` skips filter
- **Port 5000** — conflicts with macOS AirPlay; use `--port 8080`
- **AustLII 410 blocking** — rejects default `python-requests` User-Agent with HTTP 410; `BaseScraper` uses browser-like UA
- **AustLII rate limiting** — bulk scraping triggers IP block; typically resolves in hours

## Important Notes

- `downloaded_cases/` is gitignored — all scraped data is local only
- **149,023 case records** (2000-2026): ~62,500 with full text, ~86,500 metadata only (full text pending)
- 9 courts/tribunals: MRTA 52,970 | AATA 39,203 | FCA 14,987 | RRTA 13,765 | FCCA 11,157 | FMCA 10,395 | FedCFamC2G 4,109 | ARTA 2,260 | HCA 176
- Rate limiting enforced at `BaseScraper` level; respect default 1-second delay
- Test suite: 477 tests (296 unit + 181 Playwright E2E) — run `python3 -m pytest`
- CSRF protection via flask-wtf; `/api/v1/csrf-token` endpoint for React SPA
- Security headers (CSP, X-Frame-Options, etc.) set via `@app.after_request`
- Default host is `127.0.0.1` (localhost only); use `--host 0.0.0.0` to expose externally
- React SPA build: `cd frontend && npm run build` → outputs to `immi_case_downloader/static/react/`
