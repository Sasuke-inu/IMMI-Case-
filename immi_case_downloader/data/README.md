# Immigration Legislations Data

Static reference data for Australian immigration laws and regulations used by the IMMI-Case application.

## File Format

### `legislations.json` Structure

```json
{
  "legislations": [
    {
      "id": "migration-act-1958",
      "title": "Migration Act 1958",
      "shortcode": "MA1958",
      "jurisdiction": "Commonwealth",
      "type": "Act",
      "version": "1.0",
      "updated_date": "2026-02-19",
      "description": "The principal legislation governing migration to, and settlement in, Australia",
      "full_text": "...",
      "sections": 231,
      "last_amended": "2025-12-01"
    }
  ],
  "metadata": {
    "total": 6,
    "last_updated": "2026-02-19",
    "version": "1.0"
  }
}
```

### Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | URL-safe unique identifier (kebab-case) |
| `title` | string | Official legislation name |
| `shortcode` | string | Abbreviation (e.g., MA1958) |
| `jurisdiction` | string | Jurisdiction level (Commonwealth, State, etc.) |
| `type` | string | Legislation type (Act, Regulation, etc.) |
| `version` | string | Data version (e.g., 1.0) |
| `updated_date` | string | ISO 8601 date when this record was updated |
| `description` | string | Brief description of the legislation |
| `full_text` | string | Full or summarized legislation text with structure |
| `sections` | number | Number of sections/clauses in the legislation |
| `last_amended` | string | ISO 8601 date of last legislative amendment |

## Adding New Legislation

1. Add a new object to the `legislations` array in `legislations.json`
2. Ensure all required fields are populated
3. Use kebab-case for `id` field
4. Update `metadata.total` count
5. Update `metadata.last_updated` to current date
6. Test by running: `python3 -c "import json; json.load(open('legislations.json'))"`
7. Commit with message: `feat: add <legislation_name> to legislations data`

## Data Sources

- **AustLII** (Australasian Legal Information Institute): https://www.austlii.edu.au/
- **Australian Federal Legislation**: https://www.legislation.gov.au/
- Official government sources

## Notes

- This is version-controlled static data (not in `.gitignore`)
- Unlike `downloaded_cases/` directory, this data should be maintained in git
- The `full_text` field contains legislation summaries or key sections (not complete legislative documents)
- Future enhancement: Consider migrating to a database for better version control and full-text search capabilities

## Related Files

- Backend API: `immi_case_downloader/web/routes/legislations.py`
- Frontend Page: `frontend/src/pages/LegislationsPage.tsx`
- Frontend Hooks: `frontend/src/hooks/use-legislations.ts`
- API Tests: `tests/test_legislations_api.py`
