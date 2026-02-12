"""Flask web interface for the Immigration Case Downloader."""

import os
import io
import csv
import json
import threading
import logging
from datetime import datetime

from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    send_file,
    jsonify,
)

from .config import OUTPUT_DIR, AUSTLII_DATABASES, START_YEAR, END_YEAR, IMMIGRATION_KEYWORDS
from .models import ImmigrationCase
from .storage import (
    ensure_output_dirs,
    load_all_cases,
    get_case_by_id,
    update_case,
    delete_case,
    add_case_manual,
    get_case_full_text,
    get_statistics,
    save_cases_csv,
    save_cases_json,
    generate_summary_report,
    CASE_FIELDS,
)

logger = logging.getLogger(__name__)

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(__file__), "templates"),
    static_folder=os.path.join(os.path.dirname(__file__), "static"),
)
app.secret_key = os.environ.get("SECRET_KEY", "immi-case-dev-key-change-in-prod")

# Global state for background search/download jobs
_job_status = {
    "running": False,
    "type": None,
    "progress": "",
    "total": 0,
    "completed": 0,
    "errors": [],
    "results": [],
}


@app.context_processor
def inject_globals():
    """Inject global template variables (job status, pipeline status)."""
    from .pipeline import get_pipeline_status
    ps = get_pipeline_status()
    return {
        "job_running": _job_status.get("running", False),
        "pipeline_running": ps.get("running", False),
    }


# ── Helpers ───────────────────────────────────────────────────────────────

def _get_output_dir():
    return app.config.get("OUTPUT_DIR", OUTPUT_DIR)


ITEMS_PER_PAGE = 50


def _filter_cases(cases: list, args) -> list:
    """Apply standard query-param filters to a case list. Returns filtered copy."""
    court_filter = args.get("court", "")
    year_filter = args.get("year", "")
    visa_filter = args.get("visa_type", "")
    keyword = args.get("q", "")
    source_filter = args.get("source", "")
    tag_filter = args.get("tag", "")
    nature_filter = args.get("nature", "")

    if court_filter:
        cases = [c for c in cases if c.court_code == court_filter]
    if year_filter:
        try:
            cases = [c for c in cases if c.year == int(year_filter)]
        except ValueError:
            pass
    if visa_filter:
        cases = [c for c in cases if visa_filter.lower() in c.visa_type.lower()]
    if source_filter:
        cases = [c for c in cases if c.source == source_filter]
    if tag_filter:
        cases = [c for c in cases if tag_filter.lower() in c.tags.lower()]
    if nature_filter:
        cases = [c for c in cases if c.case_nature == nature_filter]
    if keyword:
        kw = keyword.lower()
        cases = [
            c for c in cases
            if kw in c.title.lower()
            or kw in c.citation.lower()
            or kw in c.catchwords.lower()
            or kw in c.judges.lower()
            or kw in c.outcome.lower()
            or kw in c.user_notes.lower()
            or kw in c.case_nature.lower()
            or kw in c.legal_concepts.lower()
        ]
    return cases


EDITABLE_FIELDS = [
    "citation", "title", "court", "court_code", "date", "year", "url",
    "judges", "catchwords", "outcome", "visa_type", "legislation",
    "user_notes", "tags", "case_nature", "legal_concepts",
]


# ── Routes ────────────────────────────────────────────────────────────────

@app.route("/")
def dashboard():
    """Dashboard with statistics and quick actions."""
    out = _get_output_dir()
    ensure_output_dirs(out)
    stats = get_statistics(out)
    return render_template("dashboard.html", stats=stats, databases=AUSTLII_DATABASES)


@app.route("/cases")
def case_list():
    """Browse, filter, and sort cases."""
    out = _get_output_dir()
    all_loaded = load_all_cases(out)
    cases = _filter_cases(list(all_loaded), request.args)

    # Sort
    sort_by = request.args.get("sort", "year")
    sort_dir = request.args.get("dir", "desc")
    reverse = sort_dir == "desc"
    if sort_by in ("year", "date", "title", "court", "citation"):
        cases.sort(key=lambda c: getattr(c, sort_by, ""), reverse=reverse)

    # Pagination
    try:
        page = max(1, int(request.args.get("page", 1)))
    except (ValueError, TypeError):
        page = 1
    total = len(cases)
    total_pages = max(1, (total + ITEMS_PER_PAGE - 1) // ITEMS_PER_PAGE)
    page = min(page, total_pages)
    start = (page - 1) * ITEMS_PER_PAGE
    page_cases = cases[start : start + ITEMS_PER_PAGE]

    # Collect unique values for filter dropdowns (reuse already-loaded data)
    courts = sorted({c.court_code for c in all_loaded if c.court_code})
    years = sorted({c.year for c in all_loaded if c.year}, reverse=True)
    sources = sorted({c.source for c in all_loaded if c.source})
    natures = sorted({c.case_nature for c in all_loaded if c.case_nature})
    all_tags = set()
    for c in all_loaded:
        if c.tags:
            for t in c.tags.split(","):
                t = t.strip()
                if t:
                    all_tags.add(t)

    return render_template(
        "cases.html",
        cases=page_cases,
        total=total,
        page=page,
        total_pages=total_pages,
        courts=courts,
        years=years,
        sources=sources,
        natures=natures,
        all_tags=sorted(all_tags),
        filters={
            "court": request.args.get("court", ""),
            "year": request.args.get("year", ""),
            "visa_type": request.args.get("visa_type", ""),
            "q": request.args.get("q", ""),
            "source": request.args.get("source", ""),
            "tag": request.args.get("tag", ""),
            "nature": request.args.get("nature", ""),
            "sort": sort_by,
            "dir": sort_dir,
        },
        databases=AUSTLII_DATABASES,
    )


@app.route("/cases/<case_id>")
def case_detail(case_id):
    """View a single case with full details."""
    case = get_case_by_id(case_id, _get_output_dir())
    if not case:
        flash("Case not found.", "error")
        return redirect(url_for("case_list"))

    full_text = get_case_full_text(case)
    return render_template("case_detail.html", case=case, full_text=full_text)


@app.route("/cases/<case_id>/edit", methods=["GET", "POST"])
def case_edit(case_id):
    """Edit a case's metadata and notes."""
    out = _get_output_dir()
    case = get_case_by_id(case_id, out)
    if not case:
        flash("Case not found.", "error")
        return redirect(url_for("case_list"))

    if request.method == "POST":
        updates = {}
        for field in EDITABLE_FIELDS:
            val = request.form.get(field, "")
            if field == "year":
                try:
                    val = int(val) if val else 0
                except ValueError:
                    val = case.year
            updates[field] = val

        if update_case(case_id, updates, out):
            flash("Case updated successfully.", "success")
        else:
            flash("Failed to update case.", "error")
        return redirect(url_for("case_detail", case_id=case_id))

    return render_template("case_edit.html", case=case, editable_fields=EDITABLE_FIELDS, databases=AUSTLII_DATABASES)


@app.route("/cases/<case_id>/delete", methods=["POST"])
def case_delete(case_id):
    """Delete a case."""
    if delete_case(case_id, _get_output_dir()):
        flash("Case deleted.", "success")
    else:
        flash("Failed to delete case.", "error")
    return redirect(url_for("case_list"))


@app.route("/cases/add", methods=["GET", "POST"])
def case_add():
    """Manually add a new case."""
    if request.method == "POST":
        data = {}
        for field in EDITABLE_FIELDS:
            data[field] = request.form.get(field, "")
        case = add_case_manual(data, _get_output_dir())
        flash(f"Case added: {case.citation or case.title}", "success")
        return redirect(url_for("case_detail", case_id=case.case_id))

    return render_template("case_add.html", editable_fields=EDITABLE_FIELDS, databases=AUSTLII_DATABASES)


# ── Search ────────────────────────────────────────────────────────────────

@app.route("/search", methods=["GET", "POST"])
def search_page():
    """Search for new immigration cases from online sources."""
    if request.method == "POST":
        # Start a background search job
        if _job_status["running"]:
            flash("A job is already running. Please wait.", "warning")
            return redirect(url_for("job_status_page"))

        databases = request.form.getlist("databases") or ["AATA", "ARTA", "FCA"]
        start_year = int(request.form.get("start_year", START_YEAR))
        end_year = int(request.form.get("end_year", END_YEAR))
        max_results = int(request.form.get("max_results", 500))
        search_fedcourt = "fedcourt" in request.form.getlist("sources")

        thread = threading.Thread(
            target=_run_search_job,
            args=(databases, start_year, end_year, max_results, search_fedcourt),
            daemon=True,
        )
        thread.start()
        flash("Search started in background.", "success")
        return redirect(url_for("job_status_page"))

    return render_template(
        "search.html",
        databases=AUSTLII_DATABASES,
        start_year=START_YEAR,
        end_year=END_YEAR,
    )


@app.route("/download", methods=["GET", "POST"])
def download_page():
    """Download full text of found cases."""
    out = _get_output_dir()
    cases = load_all_cases(out)
    without_text = [c for c in cases if not c.full_text_path or not os.path.exists(c.full_text_path)]

    if request.method == "POST":
        if _job_status["running"]:
            flash("A job is already running. Please wait.", "warning")
            return redirect(url_for("job_status_page"))

        court_filter = request.form.get("court", "")
        limit = int(request.form.get("limit", 50))

        thread = threading.Thread(
            target=_run_download_job,
            args=(court_filter, limit),
            daemon=True,
        )
        thread.start()
        flash("Download started in background.", "success")
        return redirect(url_for("job_status_page"))

    courts = sorted({c.court_code for c in without_text if c.court_code})
    return render_template(
        "download.html",
        total_cases=len(cases),
        without_text=len(without_text),
        courts=courts,
    )


# ── Job status ────────────────────────────────────────────────────────────

@app.route("/job-status")
def job_status_page():
    return render_template("job_status.html", job=_job_status)


@app.route("/api/job-status")
def job_status_api():
    return jsonify(_job_status)


# ── Export ────────────────────────────────────────────────────────────────

@app.route("/export/<fmt>")
def export_data(fmt):
    """Export cases as CSV or JSON download. Accepts same filter params as /cases."""
    out = _get_output_dir()
    cases = _filter_cases(load_all_cases(out), request.args)

    if fmt == "csv":
        si = io.StringIO()
        writer = csv.DictWriter(si, fieldnames=CASE_FIELDS)
        writer.writeheader()
        for c in cases:
            writer.writerow(c.to_dict())
        output = io.BytesIO(si.getvalue().encode("utf-8-sig"))
        return send_file(
            output,
            mimetype="text/csv",
            as_attachment=True,
            download_name=f"immigration_cases_{datetime.now():%Y%m%d}.csv",
        )

    elif fmt == "json":
        data = {
            "exported_at": datetime.now().isoformat(),
            "total_cases": len(cases),
            "cases": [c.to_dict() for c in cases],
        }
        output = io.BytesIO(json.dumps(data, indent=2, ensure_ascii=False).encode("utf-8"))
        return send_file(
            output,
            mimetype="application/json",
            as_attachment=True,
            download_name=f"immigration_cases_{datetime.now():%Y%m%d}.json",
        )

    flash("Unknown export format.", "error")
    return redirect(url_for("case_list"))


# ── Data Points Info ──────────────────────────────────────────────────────

@app.route("/data-dictionary")
def data_dictionary():
    """Show what data points are captured in the spreadsheet."""
    return render_template("data_dictionary.html")


# ── Background job runners ────────────────────────────────────────────────

def _run_search_job(databases, start_year, end_year, max_results, search_fedcourt):
    global _job_status
    _job_status = {
        "running": True,
        "type": "search",
        "progress": "Starting search...",
        "total": len(databases) + (1 if search_fedcourt else 0),
        "completed": 0,
        "errors": [],
        "results": [],
    }

    out = _get_output_dir()
    ensure_output_dirs(out)
    all_cases = []

    try:
        from .sources.austlii import AustLIIScraper

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
                from .sources.federal_court import FederalCourtScraper

                fc = FederalCourtScraper(delay=1.0)
                cases = fc.search_cases(start_year=start_year, end_year=end_year, max_results=max_results)
                existing_urls = {c.url for c in all_cases}
                new = [c for c in cases if c.url not in existing_urls]
                all_cases.extend(new)
                _job_status["results"].append(f"Federal Court: {len(new)} cases")
            except Exception as e:
                _job_status["errors"].append(f"Federal Court: {e}")
            _job_status["completed"] += 1

        # Assign IDs and merge with existing
        existing = load_all_cases(out)
        existing_urls = {c.url for c in existing}
        added = 0
        for case in all_cases:
            case.ensure_id()
            if case.url not in existing_urls:
                existing.append(case)
                existing_urls.add(case.url)
                added += 1

        save_cases_csv(existing, out)
        save_cases_json(existing, out)
        generate_summary_report(existing, out)

        _job_status["progress"] = (
            f"Done! Found {len(all_cases)} total, {added} new cases added."
        )

    except Exception as e:
        _job_status["errors"].append(f"Fatal: {e}")
        _job_status["progress"] = f"Failed: {e}"

    _job_status["running"] = False


def _run_download_job(court_filter, limit):
    global _job_status
    out = _get_output_dir()
    cases = load_all_cases(out)

    # Filter to cases without full text
    targets = [c for c in cases if not c.full_text_path or not os.path.exists(c.full_text_path)]
    if court_filter:
        targets = [c for c in targets if c.court_code == court_filter]
    targets = targets[:limit]

    _job_status = {
        "running": True,
        "type": "download",
        "progress": f"Downloading {len(targets)} cases...",
        "total": len(targets),
        "completed": 0,
        "errors": [],
        "results": [],
    }

    try:
        from .sources.austlii import AustLIIScraper
        from .sources.federal_court import FederalCourtScraper
        from .storage import save_case_text

        austlii = AustLIIScraper(delay=1.0)
        fedcourt = FederalCourtScraper(delay=1.0)

        ok = 0
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

        # Persist updated metadata
        all_cases = load_all_cases(out)
        # Merge full_text_path from downloaded targets
        target_map = {c.case_id: c for c in targets}
        for c in all_cases:
            if c.case_id in target_map and target_map[c.case_id].full_text_path:
                c.full_text_path = target_map[c.case_id].full_text_path
        save_cases_csv(all_cases, out)
        save_cases_json(all_cases, out)

        _job_status["progress"] = f"Done! Downloaded {ok}/{len(targets)} cases."
        _job_status["results"].append(f"Downloaded: {ok}, Failed: {len(targets)-ok}")

    except Exception as e:
        _job_status["errors"].append(f"Fatal: {e}")
        _job_status["progress"] = f"Failed: {e}"

    _job_status["running"] = False


# ── Update Database ───────────────────────────────────────────────────────

@app.route("/update-db", methods=["GET", "POST"])
def update_db_page():
    """One-stop page to crawl new cases and download full texts."""
    out = _get_output_dir()
    cases = load_all_cases(out)

    # Build coverage matrix: court_code -> {year: count}
    coverage = {}
    for c in cases:
        court = c.court_code
        yr = c.year
        if court and yr:
            coverage.setdefault(court, {})
            coverage[court][yr] = coverage[court].get(yr, 0) + 1

    without_text = sum(
        1 for c in cases if not c.full_text_path or not os.path.exists(c.full_text_path)
    )

    # Available year ranges per DB on AustLII
    db_year_ranges = {
        "AATA": (2000, 2024),
        "ARTA": (2024, END_YEAR),
        "FCA": (2000, END_YEAR),
        "FCCA": (2013, 2021),
        "FedCFamC2G": (2021, END_YEAR),
        "HCA": (2000, END_YEAR),
    }

    if request.method == "POST":
        if _job_status["running"]:
            flash("A job is already running. Please wait.", "warning")
            return redirect(url_for("job_status_page"))

        action = request.form.get("action", "")

        if action == "quick_update":
            # Fetch latest year for all active DBs
            thread = threading.Thread(
                target=_run_update_job,
                args=("quick",),
                kwargs={
                    "delay": float(request.form.get("delay", 0.5)),
                    "output_dir": out,
                },
                daemon=True,
            )
            thread.start()
            flash("Quick update started — fetching latest cases.", "success")
            return redirect(url_for("job_status_page"))

        elif action == "custom_crawl":
            databases = request.form.getlist("databases")
            start_year = int(request.form.get("start_year", END_YEAR))
            end_year = int(request.form.get("end_year", END_YEAR))
            delay = float(request.form.get("delay", 0.5))

            thread = threading.Thread(
                target=_run_update_job,
                args=("custom",),
                kwargs={
                    "databases": databases,
                    "start_year": start_year,
                    "end_year": end_year,
                    "delay": delay,
                    "output_dir": out,
                },
                daemon=True,
            )
            thread.start()
            flash(
                f"Custom crawl started: {', '.join(databases)} ({start_year}-{end_year}).",
                "success",
            )
            return redirect(url_for("job_status_page"))

        elif action == "bulk_download":
            court_filter = request.form.get("court", "")
            limit = int(request.form.get("limit", 1000))
            delay = float(request.form.get("delay", 0.5))

            thread = threading.Thread(
                target=_run_bulk_download_job,
                args=(court_filter, limit, delay, out),
                daemon=True,
            )
            thread.start()
            flash(f"Bulk download started: {limit} cases.", "success")
            return redirect(url_for("job_status_page"))

    return render_template(
        "update_db.html",
        databases=AUSTLII_DATABASES,
        coverage=coverage,
        total_cases=len(cases),
        without_text=without_text,
        start_year=START_YEAR,
        end_year=END_YEAR,
        db_year_ranges=db_year_ranges,
    )


def _run_update_job(mode, databases=None, start_year=None, end_year=None,
                    delay=0.5, output_dir=None):
    """Background job: crawl AustLII for new cases and merge."""
    global _job_status
    out = output_dir or _get_output_dir()

    from .sources.austlii import AustLIIScraper
    from .storage import save_cases_csv, save_cases_json

    if mode == "quick":
        # Quick update: current year + previous year for all main DBs
        databases = ["AATA", "ARTA", "FCA", "FedCFamC2G", "HCA"]
        years = [END_YEAR, END_YEAR - 1]
        total_steps = len(databases) * len(years)
    else:
        databases = databases or ["AATA"]
        start_year = start_year or END_YEAR
        end_year = end_year or END_YEAR
        years = list(range(start_year, end_year + 1))
        total_steps = len(databases) * len(years)

    _job_status = {
        "running": True,
        "type": "update",
        "progress": "Initializing...",
        "total": total_steps,
        "completed": 0,
        "errors": [],
        "results": [],
    }

    try:
        scraper = AustLIIScraper(delay=delay)
        ensure_output_dirs(out)

        existing = load_all_cases(out)
        existing_urls = {c.url for c in existing}
        total_added = 0

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
                        if case.url not in existing_urls:
                            case.ensure_id()
                            existing.append(case)
                            existing_urls.add(case.url)
                            added += 1
                    total_added += added
                    _job_status["results"].append(
                        f"{db_code} {year}: {len(cases)} found, {added} new"
                    )
                except Exception as e:
                    _job_status["errors"].append(f"{db_code} {year}: {e}")

                _job_status["completed"] += 1

        # Save merged results
        save_cases_csv(existing, out)
        save_cases_json(existing, out)

        _job_status["progress"] = (
            f"Done! Added {total_added} new cases. Total: {len(existing)}."
        )

    except Exception as e:
        _job_status["errors"].append(f"Fatal: {e}")
        _job_status["progress"] = f"Failed: {e}"

    _job_status["running"] = False


def _run_bulk_download_job(court_filter, limit, delay, output_dir):
    """Background job: download full text for many cases at once."""
    global _job_status
    out = output_dir or _get_output_dir()

    from .sources.austlii import AustLIIScraper
    from .storage import save_case_text, save_cases_csv, save_cases_json

    cases = load_all_cases(out)
    targets = [
        c for c in cases
        if not c.full_text_path or not os.path.exists(c.full_text_path)
    ]
    if court_filter:
        targets = [c for c in targets if c.court_code == court_filter]
    targets = targets[:limit]

    _job_status = {
        "running": True,
        "type": "bulk download",
        "progress": f"Downloading {len(targets)} cases...",
        "total": len(targets),
        "completed": 0,
        "errors": [],
        "results": [],
    }

    try:
        scraper = AustLIIScraper(delay=delay)
        ok = 0
        fail = 0

        for case in targets:
            _job_status["progress"] = (
                f"[{_job_status['completed']+1}/{len(targets)}] "
                f"{case.citation or case.title[:50]}"
            )
            try:
                text = scraper.download_case_detail(case)
                if text:
                    save_case_text(case, text, out)
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

            if ok > 0 and ok % 200 == 0:
                _job_status["results"].append(f"Checkpoint: {ok} downloaded so far")
                # Save progress
                all_cases = load_all_cases(out)
                target_map = {c.case_id: c for c in targets[:_job_status["completed"]]}
                for c in all_cases:
                    if c.case_id in target_map and target_map[c.case_id].full_text_path:
                        c.full_text_path = target_map[c.case_id].full_text_path
                save_cases_csv(all_cases, out)

        # Final save
        all_cases = load_all_cases(out)
        target_map = {c.case_id: c for c in targets}
        for c in all_cases:
            if c.case_id in target_map and target_map[c.case_id].full_text_path:
                c.full_text_path = target_map[c.case_id].full_text_path
        save_cases_csv(all_cases, out)
        save_cases_json(all_cases, out)

        _job_status["progress"] = f"Done! Downloaded {ok}/{len(targets)} cases."
        _job_status["results"].append(f"Total: {ok} downloaded, {fail} failed")

    except Exception as e:
        _job_status["errors"].append(f"Fatal: {e}")
        _job_status["progress"] = f"Failed: {e}"

    _job_status["running"] = False


# ── Smart Pipeline ────────────────────────────────────────────────────────

@app.route("/pipeline", methods=["GET", "POST"])
def pipeline_page():
    """Smart Pipeline: configure, launch, and monitor."""
    from .pipeline import PipelineConfig, start_pipeline, get_pipeline_status

    if request.method == "POST":
        ps = get_pipeline_status()
        if ps["running"]:
            flash("Pipeline is already running.", "warning")
            return redirect(url_for("pipeline_page"))
        if _job_status["running"]:
            flash("Another job is running. Please wait.", "warning")
            return redirect(url_for("pipeline_page"))

        config = PipelineConfig.from_form(request.form)
        out = _get_output_dir()
        if start_pipeline(config, out):
            flash("Smart Pipeline started!", "success")
        else:
            flash("Failed to start pipeline.", "error")
        return redirect(url_for("pipeline_page"))

    out = _get_output_dir()
    cases = load_all_cases(out)
    without_text = sum(
        1 for c in cases if not c.full_text_path or not os.path.exists(c.full_text_path)
    )
    ps = get_pipeline_status()

    return render_template(
        "pipeline.html",
        databases=AUSTLII_DATABASES,
        start_year=START_YEAR,
        end_year=END_YEAR,
        total_cases=len(cases),
        without_text=without_text,
        pipeline=ps,
    )


@app.route("/api/pipeline-status")
def pipeline_status_api():
    """JSON API for real-time pipeline monitoring."""
    from .pipeline import get_pipeline_status
    return jsonify(get_pipeline_status())


@app.route("/api/pipeline-log")
def pipeline_log_api():
    """JSON API for structured debug logs with optional filtering."""
    from .pipeline import get_pipeline_status
    ps = get_pipeline_status()
    log = ps.get("log", [])

    phase = request.args.get("phase", "")
    level = request.args.get("level", "")
    limit = int(request.args.get("limit", 200))

    if phase:
        log = [e for e in log if e.get("phase") == phase]
    if level:
        log = [e for e in log if e.get("level") == level]

    return jsonify(log[-limit:])


@app.route("/api/pipeline-action", methods=["POST"])
def pipeline_action_api():
    """Handle user actions: stop pipeline."""
    from .pipeline import request_pipeline_stop

    data = request.get_json(silent=True) or {}
    action = data.get("action", "")

    if action == "stop":
        request_pipeline_stop()
        return jsonify({"ok": True, "message": "Stop requested."})

    return jsonify({"ok": False, "message": f"Unknown action: {action}"}), 400


# ── App factory ───────────────────────────────────────────────────────────

def create_app(output_dir: str = OUTPUT_DIR):
    app.config["OUTPUT_DIR"] = output_dir
    ensure_output_dirs(output_dir)
    return app
