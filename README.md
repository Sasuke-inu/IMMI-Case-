# IMMI-Case - Immigration Case Downloader & Manager

A Python tool to download, extract, browse, and manage Australian immigration, home affairs, and refugee-related court and tribunal appeal cases from the last 10 years.

Includes a **React SPA** (with Vite + TypeScript + Tailwind) and a **Flask API** for searching, browsing, editing, and exporting cases.

## Data Sources

| Source | Code | Years | Description |
|--------|------|-------|-------------|
| Administrative Appeals Tribunal | AATA | 2000–2024 | AAT migration & refugee review decisions (ended Oct 2024) |
| Administrative Review Tribunal | **ARTA** | 2024– | ART migration & refugee review decisions (replaced AAT) |
| Federal Court of Australia | FCA | 2000– | Immigration judicial review |
| Federal Circuit Court | FCCA | 2013–2021 | Immigration cases (replaced by FedCFamC2G) |
| Federal Circuit and Family Court (Div 2) | FedCFamC2G | 2021– | Immigration cases (post-restructure) |
| High Court of Australia | HCA | 2000– | Immigration appeals |
| Refugee Review Tribunal | RRTA | –2015 | Refugee decisions (merged into AATA) |
| Migration Review Tribunal | MRTA | –2015 | Migration decisions (merged into AATA) |

Cases are sourced from [AustLII](https://www.austlii.edu.au) (Australasian Legal Information Institute).

> **Note**: The AAT was abolished in October 2024 and replaced by the Administrative Review Tribunal (ART). For cases from 2025 onwards, use the **ARTA** database code.

## Setup

```bash
pip install -r requirements.txt

# For React frontend development
cd frontend && npm install
```

## Web Interface

Start the web interface:

```bash
python web.py --port 8080        # http://localhost:8080/app/
python web.py --debug             # Debug mode
```

The React SPA is served at `/app/` and the API at `/api/v1/*`. Legacy Jinja2 templates remain accessible at the original routes (`/`, `/cases`, etc.).

### React Frontend Development

```bash
cd frontend
npm run dev                       # Vite dev server with HMR
npm run build                     # Production build → static/react/
npm run tokens                    # Rebuild design tokens (CSS + TS)
```

### Web Interface Features

| Page | What you can do |
|------|-----------------|
| **Dashboard** | View stats: total cases, cases by court/year, top outcomes, quick actions |
| **Cases** | Filter by court, year, visa type, nature, keyword, tags. Table & card views. Batch operations |
| **Case Detail** | View metadata, catchwords, full text, related cases. Edit/delete actions |
| **Case Compare** | Side-by-side comparison of 2–5 selected cases |
| **Scrape AustLII** | Batch download full case texts with progress tracking |
| **Smart Pipeline** | 3-phase automated workflow: crawl → clean → download |
| **Data Dictionary** | Reference guide for all 22 data fields |
| **Design Tokens** | Live design token reference with theme presets |

## CLI Usage

### Search for cases

```bash
python run.py search                                    # All sources, last 10 years
python run.py search --databases AATA FCA               # Only AAT and Federal Court
python run.py search --start-year 2020 --end-year 2025  # Custom year range
python run.py search --max-results 1000                 # More results per database
```

### Download full case texts

```bash
python run.py download                      # Download all found cases
python run.py download --courts FCA         # Download only Federal Court cases
python run.py download --limit 50           # Limit to 50 downloads
```

### Other CLI commands

```bash
python run.py list-databases    # List available databases
python run.py --help            # Full help
```

### CLI Options

```
-v, --verbose       Enable verbose/debug logging
-o, --output DIR    Output directory (default: downloaded_cases)
--delay SECONDS     Delay between HTTP requests (default: 1.0)
```

## Output

Results are saved to the `downloaded_cases/` directory:

```
downloaded_cases/
  immigration_cases.csv       # All case metadata in CSV format
  immigration_cases.json      # All case metadata in JSON format
  summary_report.txt          # Summary statistics
  case_texts/                 # Full text of downloaded cases
    [2024] AATA 1234.txt
    [2024] FCA 567.txt
    ...
```

## Spreadsheet Data Points (CSV/JSON columns)

There are **22 data fields** per case, populated in stages:

### Stage 1: Search (auto-populated from listing pages)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `case_id` | Text | Auto-generated unique ID (12-char hash) | `a3f8b2c1d4e5` |
| `citation` | Text | Legal citation | `[2024] AATA 1234` |
| `title` | Text | Case title / parties | `Smith v Minister for Immigration` |
| `court` | Text | Full court name | `Administrative Appeals Tribunal` |
| `court_code` | Text | Court abbreviation | `AATA`, `ARTA`, `FCA`, `FCCA`, `HCA` |
| `year` | Integer | Decision year | `2024` |
| `url` | URL | Link to source document | `https://austlii.edu.au/...` |
| `source` | Text | Where found | `AustLII`, `Federal Court` |

### Stage 2: Download (extracted from full case text)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `date` | Text | Decision date | `15 March 2024` |
| `judges` | Text | Judge / tribunal member | `Gabrielle Cullen` |
| `catchwords` | Text | Legal topics/keywords | `MIGRATION - Protection visa...` |
| `outcome` | Text | Decision result | `Tribunal affirms the decision` |
| `visa_type` | Text | Visa type involved | `protection visa`, `Subclass 500` |
| `visa_subclass` | Text | Visa subclass number | `500`, `801`, `189` |
| `visa_class_code` | Text | Visa class code | `XB`, `BW`, `VC` |
| `legislation` | Text | Acts/sections cited | `Migration Act 1958 s 36` |
| `text_snippet` | Text | Brief excerpt | (first ~300 chars) |
| `full_text_path` | Path | Local .txt file path | `downloaded_cases/case_texts/...` |
| `case_nature` | Text | Nature of the case (LLM-extracted) | `Refugee review`, `Visa cancellation` |
| `legal_concepts` | Text | Key legal concepts (LLM-extracted) | `well-founded fear, complementary protection` |

### Stage 3: User annotations (editable via web interface)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `user_notes` | Text | Your personal notes/analysis | `Key case for s501 character test` |
| `tags` | Text | Comma-separated labels | `important, character-test, s501` |

## Smart Pipeline

The Smart Pipeline provides a 3-phase automated workflow accessible from the web UI:

1. **Crawl** — Scrape case metadata from AustLII with auto-fallback strategies (year listing → viewdb → keyword search)
2. **Clean** — Deduplicate, fill missing fields (year from citation, court codes), validate data
3. **Download** — Bulk download full case texts with resumable progress

```bash
# Via web UI: navigate to Smart Pipeline page
# Via CLI:
python run.py search --databases AATA ARTA FCA --start-year 2020
python download_fulltext.py
```

## LLM Field Extraction

For enriching cases with `case_nature` and `legal_concepts` fields:

```bash
python extract_llm_fields.py    # Process cases in batches via Claude Sonnet
python merge_llm_results.py     # Merge batch JSON results back into main CSV
```

## New Features (Feb 2026)

### 1. **澳洲移民法律瀏覽器** (Legislations Feature)
Browse and search Australian immigration legislation with full i18n support (English + Traditional Chinese):

- **Pages**: Legislations list with search and pagination, detailed legislation view
- **API**: `/api/v1/legislations/*` endpoints (list, detail, search)
- **Data**: 6 Australian immigration laws in static JSON format
- **Features**: Full-text search (minimum 2 characters), pagination, multi-language interface

Navigate to **"法律法規"** in the sidebar to explore.

### 2. **Supabase Cloud Sync**
Cloud-based case database with PostgreSQL backend:

- **Synced Data**: 149,023 immigration cases
- **Tools**: Supabase MCP for direct database access
- **Configuration**: Already set up for IMMI-Case project
- **Access**: Via Supabase Python client or MCP server

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3, Flask, pandas, BeautifulSoup/lxml |
| **Frontend** | React 18, TypeScript, Vite 6, Tailwind CSS v4, TanStack Query, Recharts, Sonner |
| **Storage** | CSV/JSON (default), SQLite (FTS5+WAL), Supabase (PostgreSQL) |
| **Testing** | pytest (296 unit tests), Playwright (181 E2E tests) |
| **LLM** | Claude Sonnet (field extraction), 10 parallel sub-agents |
| **MCP** | Context7 (knowledge retrieval), Supabase (database operations) |

## Rate Limiting & User-Agent

Built-in rate limiting (default: 1 second between requests) to be respectful to source servers. Adjust with `--delay` (CLI) or in config.

> **Note**: AustLII blocks requests with the default `python-requests` User-Agent (HTTP 410). The scraper uses a browser-like User-Agent string to avoid this.

## License

For legal research and educational purposes.
