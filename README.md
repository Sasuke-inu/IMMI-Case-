# IMMI-Case - Immigration Case Downloader & Manager

A Python tool to download, extract, browse, and manage Australian immigration, home affairs, and refugee-related court and tribunal appeal cases from the last 10 years.

Includes a **web interface** for searching, browsing, editing, and exporting cases.

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
| Federal Court Judgment Search | fedcourt | — | search2.fedcourt.gov.au |

Cases are sourced from [AustLII](https://www.austlii.edu.au) (Australasian Legal Information Institute) and the Federal Court judgment search.

> **Note**: The AAT was abolished in October 2024 and replaced by the Administrative Review Tribunal (ART). For cases from 2025 onwards, use the **ARTA** database code.

## Setup

```bash
pip install -r requirements.txt
```

## Web Interface

Start the web interface:

```bash
python web.py                    # http://localhost:5000
python web.py --port 8080        # Custom port
python web.py --debug            # Debug mode
```

### Web Interface Features

| Page | What you can do |
|------|-----------------|
| **Dashboard** | View stats: total cases, cases by court/year, visa types, quick actions |
| **Browse Cases** | Filter by court, year, visa type, source, keyword, tags. Sort and paginate |
| **Case Detail** | View all metadata, full case text, notes, tags. Link to source |
| **Edit Case** | Update any field: metadata, notes, tags, corrections |
| **Add Case** | Manually enter a case not found in online sources |
| **Delete Case** | Remove cases from your collection |
| **Search New** | Launch background searches across AustLII / Federal Court |
| **Download Texts** | Batch download full case texts with progress tracking |
| **Smart Pipeline** | 3-phase auto-fallback workflow: crawl → clean → download |
| **Update DB** | Add new databases or update existing ones |
| **Job Status** | Monitor running search/download jobs with live progress |
| **Export** | Download all data as CSV or JSON |
| **Data Dictionary** | Reference guide for all spreadsheet columns |

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

There are **20 data fields** per case, populated in stages:

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

## Expanding & Updating Records

The tool is designed to grow your collection over time:

- **Run search again** to find newly published cases (deduplicates automatically)
- **Edit any field** via the web interface (Browse > click case > Edit)
- **Add cases manually** via web interface (Add Case page)
- **Tag and annotate** cases with your own notes and labels
- **Export updated data** anytime as CSV or JSON

## Smart Pipeline

The Smart Pipeline provides a 3-phase automated workflow accessible from both the web UI and CLI:

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

## Module Usage

```python
from immi_case_downloader.sources import AustLIIScraper, FederalCourtScraper
from immi_case_downloader.storage import save_cases_csv, save_cases_json

# Search AustLII
scraper = AustLIIScraper(delay=1.0)
cases = scraper.search_cases(
    databases=["AATA", "ARTA", "FCA"],
    start_year=2020,
    end_year=2026,
)

# Save results
save_cases_csv(cases)
save_cases_json(cases)

# Download full text of a specific case
text = scraper.download_case_detail(cases[0])
```

## Rate Limiting & User-Agent

Built-in rate limiting (default: 1 second between requests) to be respectful to source servers. Adjust with `--delay` (CLI) or in config.

> **Note**: AustLII blocks requests with the default `python-requests` User-Agent (HTTP 410). The scraper uses a browser-like User-Agent string to avoid this.

## License

For legal research and educational purposes.
