# IMMI-Case - Immigration Case Downloader

A Python tool to download and extract Australian immigration, home affairs, and refugee-related court and tribunal appeal cases from the last 10 years.

## Data Sources

| Source | Code | Description |
|--------|------|-------------|
| Administrative Appeals Tribunal | AATA | AAT migration & refugee review decisions |
| Federal Court of Australia | FCA | Immigration judicial review |
| Federal Circuit Court | FCCA | Immigration cases |
| Federal Circuit and Family Court (Div 2) | FedCFamC2G | Immigration cases (post-restructure) |
| High Court of Australia | HCA | Immigration appeals |
| Refugee Review Tribunal | RRTA | Refugee decisions (pre-2015) |
| Migration Review Tribunal | MRTA | Migration decisions (pre-2015) |
| Federal Court Judgment Search | fedcourt | search2.fedcourt.gov.au |

Cases are sourced from [AustLII](https://www.austlii.edu.au) (Australasian Legal Information Institute) and the Federal Court judgment search.

## Setup

```bash
# Install dependencies
pip install -r requirements.txt
```

## Usage

### Search for cases

Search all sources for immigration cases from the last 10 years:

```bash
python run.py search
```

Search specific databases:

```bash
# Only AAT and Federal Court
python run.py search --databases AATA FCA

# Only AustLII sources (not Federal Court search)
python run.py search --sources austlii

# Custom year range
python run.py search --start-year 2020 --end-year 2025

# Increase max results per database
python run.py search --max-results 1000
```

### Download full case texts

After searching, download the full text of found cases:

```bash
# Download all found cases
python run.py download

# Download only Federal Court cases
python run.py download --courts FCA

# Limit to 50 downloads
python run.py download --limit 50
```

### List available databases

```bash
python run.py list-databases
```

### Options

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

### CSV/JSON fields

| Field | Description |
|-------|-------------|
| case_id | Unique case identifier |
| citation | Legal citation (e.g., [2024] AATA 1234) |
| title | Case title / parties |
| court | Court or tribunal name |
| court_code | Court code (AATA, FCA, etc.) |
| date | Decision date |
| year | Decision year |
| url | Source URL |
| judges | Judge(s) or tribunal member(s) |
| catchwords | Legal catchwords/topics |
| outcome | Decision outcome |
| visa_type | Visa type involved (if detected) |
| legislation | Relevant legislation |
| source | Data source (AustLII, Federal Court) |

## Search Keywords

The tool searches for cases matching these immigration indicators:
- Minister for Immigration / Home Affairs
- Department of Home Affairs / Immigration
- Migration Act / Migration Regulations
- Protection visa, bridging visa, visa cancellation
- Refugee, deportation, removal
- Character test (s 501)
- Migration/Refugee Review Tribunal

## Module Usage

```python
from immi_case_downloader.sources import AustLIIScraper, FederalCourtScraper
from immi_case_downloader.storage import save_cases_csv, save_cases_json

# Search AustLII
scraper = AustLIIScraper(delay=1.0)
cases = scraper.search_cases(
    databases=["AATA", "FCA"],
    start_year=2020,
    end_year=2025,
)

# Save results
save_cases_csv(cases)
save_cases_json(cases)

# Download full text of a specific case
text = scraper.download_case_detail(cases[0])
```

## Rate Limiting

The tool includes built-in rate limiting (default: 1 second between requests) to be respectful to source servers. Adjust with `--delay`.

## License

For legal research and educational purposes.
