"""Background job state and runner functions.

All job functions mutate _job_status IN-PLACE (via clear()+update()) to
preserve references held by the webapp.py shim and test code.

Jobs accept an optional ``repo`` parameter (a CaseRepository instance).
When provided, data is persisted through the repository; otherwise a
CsvRepository is created as a fallback.
"""

import os
import threading
import logging

from ..config import AUSTLII_DATABASES, IMMIGRATION_KEYWORDS, END_YEAR
from ..storage import ensure_output_dirs
from .helpers import get_output_dir, safe_float, safe_int

logger = logging.getLogger(__name__)


# ── Global job state (protected by _job_lock) ────────────────────────────

_job_lock = threading.Lock()
_job_status = {
    "running": False,
    "type": None,
    "progress": "",
    "total": 0,
    "completed": 0,
    "errors": [],
    "results": [],
}


def _reset_job_status(new_status: dict):
    """Replace _job_status contents in-place, preserving the dict identity."""
    _job_status.clear()
    _job_status.update(new_status)


def _ensure_repo(repo, output_dir):
    """Return ``repo`` if given, else create a CsvRepository for *output_dir*."""
    if repo is not None:
        return repo
    from ..csv_repository import CsvRepository
    return CsvRepository(output_dir)


# ── Background job runners ───────────────────────────────────────────────


def _run_search_job(databases, start_year, end_year, max_results, search_fedcourt,
                    output_dir=None, repo=None):
    out = output_dir or get_output_dir()
    repo = _ensure_repo(repo, out)

    _reset_job_status({
        "running": True,
        "type": "search",
        "progress": "Starting search...",
        "total": len(databases) + (1 if search_fedcourt else 0),
        "completed": 0,
        "errors": [],
        "results": [],
    })

    ensure_output_dirs(out)
    all_cases = []

    try:
        from ..sources.austlii import AustLIIScraper

        scraper = AustLIIScraper(delay=1.0)
        for db_code in databases:
            _job_status["progress"] = f"Searching {AUSTLII_DATABASES.get(db_code, {}).get('name', db_code)}..."
            try:
                cases = scraper.search_cases(
                    databases=[db_code],
                    start_year=start_year,
                    end_year=end_year,
                    max_results_per_db=max_results,
                )
                all_cases.extend(cases)
                _job_status["results"].append(
                    f"{db_code}: {len(cases)} cases"
                )
            except Exception as e:
                _job_status["errors"].append(f"{db_code}: {e}")
            _job_status["completed"] += 1

        if search_fedcourt:
            _job_status["progress"] = "Searching Federal Court..."
            try:
                from ..sources.federal_court import FederalCourtScraper

                fc = FederalCourtScraper(delay=1.0)
                cases = fc.search_cases(start_year=start_year, end_year=end_year, max_results=max_results)
                existing_urls = {c.url for c in all_cases}
                new = [c for c in cases if c.url not in existing_urls]
                all_cases.extend(new)
                _job_status["results"].append(f"Federal Court: {len(new)} cases")
            except Exception as e:
                _job_status["errors"].append(f"Federal Court: {e}")
            _job_status["completed"] += 1

        # Assign IDs and deduplicate against existing
        for case in all_cases:
            case.ensure_id()

        existing_urls = repo.get_existing_urls()
        new_cases = [c for c in all_cases if c.url and c.url not in existing_urls]

        if new_cases:
            repo.save_many(new_cases)

        # Generate summary report (filesystem operation)
        try:
            from ..storage import generate_summary_report
            all_existing = repo.load_all()
            generate_summary_report(all_existing, out)
        except Exception:
            pass

        _job_status["progress"] = (
            f"Done! Found {len(all_cases)} total, {len(new_cases)} new cases added."
        )

    except Exception as e:
        _job_status["errors"].append(f"Fatal: {e}")
        _job_status["progress"] = f"Failed: {e}"

    _job_status["running"] = False


def _run_download_job(court_filter, limit, output_dir=None, repo=None):
    out = output_dir or get_output_dir()
    repo = _ensure_repo(repo, out)
    cases = repo.load_all()

    # Filter to cases without full text
    targets = [c for c in cases if not c.full_text_path or not os.path.exists(c.full_text_path)]
    if court_filter:
        targets = [c for c in targets if c.court_code == court_filter]
    targets = targets[:limit]

    _reset_job_status({
        "running": True,
        "type": "download",
        "progress": f"Downloading {len(targets)} cases...",
        "total": len(targets),
        "completed": 0,
        "errors": [],
        "results": [],
    })

    try:
        from ..sources.austlii import AustLIIScraper
        from ..sources.federal_court import FederalCourtScraper
        from ..storage import save_case_text

        austlii = AustLIIScraper(delay=1.0)
        fedcourt = FederalCourtScraper(delay=1.0)

        ok = 0
        updated = []
        for case in targets:
            _job_status["progress"] = (
                f"[{_job_status['completed']+1}/{len(targets)}] "
                f"{case.citation or case.title[:50]}"
            )
            try:
                if case.source == "Federal Court":
                    text = fedcourt.download_case_detail(case)
                else:
                    text = austlii.download_case_detail(case)

                if text:
                    save_case_text(case, text, out)
                    updated.append(case)
                    ok += 1
                else:
                    _job_status["errors"].append(
                        f"{case.citation or case.case_id}: no content"
                    )
            except Exception as e:
                _job_status["errors"].append(
                    f"{case.citation or case.case_id}: {e}"
                )
            _job_status["completed"] += 1

        # Persist updated full_text_path via upsert
        if updated:
            repo.save_many(updated)

        _job_status["progress"] = f"Done! Downloaded {ok}/{len(targets)} cases."
        _job_status["results"].append(f"Downloaded: {ok}, Failed: {len(targets)-ok}")

    except Exception as e:
        _job_status["errors"].append(f"Fatal: {e}")
        _job_status["progress"] = f"Failed: {e}"

    _job_status["running"] = False


def _run_update_job(mode, databases=None, start_year=None, end_year=None,
                    delay=0.5, output_dir=None, repo=None):
    """Background job: crawl AustLII for new cases and merge."""
    out = output_dir or get_output_dir()
    repo = _ensure_repo(repo, out)

    from ..sources.austlii import AustLIIScraper

    if mode == "quick":
        databases = ["AATA", "ARTA", "FCA", "FedCFamC2G", "HCA"]
        years = [END_YEAR, END_YEAR - 1]
        total_steps = len(databases) * len(years)
    else:
        databases = databases or ["AATA"]
        start_year = start_year or END_YEAR
        end_year = end_year or END_YEAR
        years = list(range(start_year, end_year + 1))
        total_steps = len(databases) * len(years)

    _reset_job_status({
        "running": True,
        "type": "update",
        "progress": "Initializing...",
        "total": total_steps,
        "completed": 0,
        "errors": [],
        "results": [],
    })

    try:
        scraper = AustLIIScraper(delay=delay)
        ensure_output_dirs(out)

        existing_urls = repo.get_existing_urls()
        all_new = []

        for db_code in databases:
            if db_code not in AUSTLII_DATABASES:
                _job_status["errors"].append(f"Unknown database: {db_code}")
                continue

            db_info = AUSTLII_DATABASES[db_code]

            for year in years:
                _job_status["progress"] = f"Crawling {db_code} {year}..."
                try:
                    cases = scraper._browse_year(
                        db_code, db_info, year, IMMIGRATION_KEYWORDS
                    )
                    added = 0
                    for case in cases:
                        case.ensure_id()
                        if case.url and case.url not in existing_urls:
                            all_new.append(case)
                            existing_urls.add(case.url)
                            added += 1
                    _job_status["results"].append(
                        f"{db_code} {year}: {len(cases)} found, {added} new"
                    )
                except Exception as e:
                    _job_status["errors"].append(f"{db_code} {year}: {e}")

                _job_status["completed"] += 1

        # Save all new cases via repository
        if all_new:
            repo.save_many(all_new)

        _job_status["progress"] = (
            f"Done! Added {len(all_new)} new cases."
        )

    except Exception as e:
        _job_status["errors"].append(f"Fatal: {e}")
        _job_status["progress"] = f"Failed: {e}"

    _job_status["running"] = False


def _run_bulk_download_job(court_filter, limit, delay, output_dir, repo=None):
    """Background job: download full text for many cases at once."""
    out = output_dir or get_output_dir()
    repo = _ensure_repo(repo, out)

    from ..sources.austlii import AustLIIScraper
    from ..storage import save_case_text

    cases = repo.load_all()
    targets = [
        c for c in cases
        if not c.full_text_path or not os.path.exists(c.full_text_path)
    ]
    if court_filter:
        targets = [c for c in targets if c.court_code == court_filter]
    targets = targets[:limit]

    _reset_job_status({
        "running": True,
        "type": "bulk download",
        "progress": f"Downloading {len(targets)} cases...",
        "total": len(targets),
        "completed": 0,
        "errors": [],
        "results": [],
    })

    try:
        scraper = AustLIIScraper(delay=delay)
        ok = 0
        fail = 0
        updated_batch = []

        for case in targets:
            _job_status["progress"] = (
                f"[{_job_status['completed']+1}/{len(targets)}] "
                f"{case.citation or case.title[:50]}"
            )
            try:
                text = scraper.download_case_detail(case)
                if text:
                    save_case_text(case, text, out)
                    updated_batch.append(case)
                    ok += 1
                else:
                    fail += 1
            except Exception as e:
                fail += 1
                if fail <= 20:
                    _job_status["errors"].append(
                        f"{case.citation or case.case_id}: {e}"
                    )
            _job_status["completed"] += 1

            # Checkpoint save every 200 successful downloads
            if ok > 0 and ok % 200 == 0 and updated_batch:
                _job_status["results"].append(f"Checkpoint: {ok} downloaded so far")
                repo.save_many(updated_batch)
                updated_batch.clear()

        # Final save
        if updated_batch:
            repo.save_many(updated_batch)

        _job_status["progress"] = f"Done! Downloaded {ok}/{len(targets)} cases."
        _job_status["results"].append(f"Total: {ok} downloaded, {fail} failed")

    except Exception as e:
        _job_status["errors"].append(f"Fatal: {e}")
        _job_status["progress"] = f"Failed: {e}"

    _job_status["running"] = False
