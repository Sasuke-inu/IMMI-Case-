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

from .config import OUTPUT_DIR, AUSTLII_DATABASES, START_YEAR, END_YEAR
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
    """Inject global template variables (job status, etc.)."""
    return {"job_running": _job_status.get("running", False)}


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

        databases = request.form.getlist("databases") or ["AATA", "FCA"]
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


# ── App factory ───────────────────────────────────────────────────────────

def create_app(output_dir: str = OUTPUT_DIR):
    app.config["OUTPUT_DIR"] = output_dir
    ensure_output_dirs(output_dir)
    return app
