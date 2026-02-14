"""JSON API endpoints for the React SPA frontend.

All endpoints are prefixed with /api/v1/.
Reuses existing CaseRepository methods — no new backend logic.
"""

import io
import csv
import re
import json
import threading
from datetime import datetime

from flask import Blueprint, request, jsonify, send_file
from flask_wtf.csrf import generate_csrf

from ...config import START_YEAR, END_YEAR
from ...models import ImmigrationCase
from ...storage import CASE_FIELDS
from ..helpers import get_repo, get_output_dir, safe_int, safe_float, _filter_cases, EDITABLE_FIELDS
from ..jobs import _job_lock, _job_status, _run_search_job, _run_download_job, _run_update_job
from ..security import csrf

api_bp = Blueprint("api", __name__, url_prefix="/api/v1")

_HEX_ID = re.compile(r"^[0-9a-f]{12}$")
MAX_BATCH_SIZE = 200
MAX_TAG_LENGTH = 50

DATA_DICTIONARY_FIELDS = [
    {"name": "case_id", "type": "string", "description": "SHA-256 hash (first 12 chars) of citation/URL/title", "example": "a1b2c3d4e5f6"},
    {"name": "citation", "type": "string", "description": "Official case citation", "example": "[2024] AATA 1234"},
    {"name": "title", "type": "string", "description": "Case title / party names", "example": "Smith v Minister for Immigration"},
    {"name": "court", "type": "string", "description": "Full court/tribunal name", "example": "Administrative Appeals Tribunal"},
    {"name": "court_code", "type": "string", "description": "Short court identifier", "example": "AATA"},
    {"name": "date", "type": "string", "description": "Decision date (DD Month YYYY)", "example": "15 March 2024"},
    {"name": "year", "type": "integer", "description": "Decision year", "example": "2024"},
    {"name": "url", "type": "string", "description": "AustLII or Federal Court URL", "example": "https://www.austlii.edu.au/..."},
    {"name": "judges", "type": "string", "description": "Judge(s) or tribunal member(s)", "example": "Deputy President S Smith"},
    {"name": "catchwords", "type": "string", "description": "Key legal topics from the case", "example": "MIGRATION - visa cancellation..."},
    {"name": "outcome", "type": "string", "description": "Decision outcome", "example": "Dismissed"},
    {"name": "visa_type", "type": "string", "description": "Visa subclass or category", "example": "Subclass 866 Protection"},
    {"name": "legislation", "type": "string", "description": "Referenced legislation", "example": "Migration Act 1958 (Cth) s 501"},
    {"name": "text_snippet", "type": "string", "description": "Short excerpt from case text", "example": "The Tribunal finds that..."},
    {"name": "full_text_path", "type": "string", "description": "Path to downloaded full text file", "example": "downloaded_cases/case_texts/a1b2c3d4e5f6.txt"},
    {"name": "source", "type": "string", "description": "Data source identifier", "example": "austlii"},
    {"name": "user_notes", "type": "string", "description": "User-added notes", "example": "Important precedent for..."},
    {"name": "tags", "type": "string", "description": "Comma-separated user tags", "example": "review, important"},
    {"name": "case_nature", "type": "string", "description": "Nature/category of the case (LLM-extracted)", "example": "Protection visa refusal"},
    {"name": "legal_concepts", "type": "string", "description": "Key legal concepts (LLM-extracted)", "example": "well-founded fear, complementary protection"},
]


def _valid_case_id(case_id: str) -> bool:
    return bool(_HEX_ID.match(case_id))


def _error(msg: str, status: int = 400):
    return jsonify({"error": msg}), status


# ── CSRF ────────────────────────────────────────────────────────────────

@api_bp.route("/csrf-token")
def get_csrf_token():
    return jsonify({"csrf_token": generate_csrf()})


# ── Dashboard Stats ─────────────────────────────────────────────────────

@api_bp.route("/stats")
def stats():
    repo = get_repo()
    s = repo.get_statistics()

    # Transform to DashboardStats shape expected by React frontend
    courts = s.get("by_court", {})
    sources_list = s.get("sources", [])
    sources_dict = {src: 0 for src in sources_list}
    # Count cases per source if available
    try:
        all_cases = repo.filter_cases(page=1, page_size=99999)
        for c in all_cases[0]:
            if c.source and c.source in sources_dict:
                sources_dict[c.source] += 1
    except Exception:
        sources_dict = {src: 1 for src in sources_list}

    # Get recent cases (latest 5 by date)
    recent = []
    try:
        recent_cases, _ = repo.filter_cases(sort_by="date", sort_dir="desc", page=1, page_size=5)
        recent = [
            {
                "case_id": c.case_id, "title": c.title, "citation": c.citation,
                "court_code": c.court_code, "date": c.date, "outcome": c.outcome,
            }
            for c in recent_cases
        ]
    except Exception:
        pass

    return jsonify({
        "total_cases": s.get("total", 0),
        "with_full_text": s.get("with_full_text", 0),
        "courts": courts,
        "years": s.get("by_year", {}),
        "outcomes": s.get("by_nature", {}),
        "sources": sources_dict,
        "recent_cases": recent,
    })


# ── Cases CRUD ──────────────────────────────────────────────────────────

@api_bp.route("/cases")
def list_cases():
    repo = get_repo()
    court = request.args.get("court", "")
    year_str = request.args.get("year", "")
    year = None
    if year_str:
        try:
            year = int(year_str)
        except ValueError:
            pass
    visa_type = request.args.get("visa_type", "")
    keyword = request.args.get("keyword", "")
    source = request.args.get("source", "")
    tag = request.args.get("tag", "")
    nature = request.args.get("nature", "")
    sort_by = request.args.get("sort_by", "year")
    sort_dir = request.args.get("sort_dir", "desc")
    page = safe_int(request.args.get("page"), default=1, min_val=1)
    page_size = safe_int(request.args.get("page_size"), default=50, min_val=1, max_val=200)

    page_cases, total = repo.filter_cases(
        court=court, year=year, visa_type=visa_type,
        source=source, tag=tag, nature=nature, keyword=keyword,
        sort_by=sort_by, sort_dir=sort_dir,
        page=page, page_size=page_size,
    )

    total_pages = max(1, (total + page_size - 1) // page_size)

    return jsonify({
        "cases": [c.to_dict() for c in page_cases],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    })


@api_bp.route("/cases/<case_id>")
def get_case(case_id):
    if not _valid_case_id(case_id):
        return _error("Invalid case ID")
    repo = get_repo()
    case = repo.get_by_id(case_id)
    if not case:
        return _error("Case not found", 404)
    full_text = repo.get_case_full_text(case)
    return jsonify({"case": case.to_dict(), "full_text": full_text})


@api_bp.route("/cases", methods=["POST"])
def create_case():
    data = request.get_json(silent=True) or {}
    if not data.get("title") and not data.get("citation"):
        return _error("Title or citation is required")
    case = ImmigrationCase.from_dict(data)
    repo = get_repo()
    case = repo.add(case)
    return jsonify(case.to_dict()), 201


@api_bp.route("/cases/<case_id>", methods=["PUT"])
def update_case(case_id):
    if not _valid_case_id(case_id):
        return _error("Invalid case ID")
    repo = get_repo()
    case = repo.get_by_id(case_id)
    if not case:
        return _error("Case not found", 404)

    data = request.get_json(silent=True) or {}
    updates = {}
    for field in EDITABLE_FIELDS:
        if field in data:
            val = data[field]
            if field == "year":
                try:
                    val = int(val) if val else 0
                except (ValueError, TypeError):
                    val = case.year
            updates[field] = val

    if repo.update(case_id, updates):
        updated = repo.get_by_id(case_id)
        return jsonify(updated.to_dict() if updated else {})
    return _error("Failed to update case", 500)


@api_bp.route("/cases/<case_id>", methods=["DELETE"])
def delete_case(case_id):
    if not _valid_case_id(case_id):
        return _error("Invalid case ID")
    repo = get_repo()
    if repo.delete(case_id):
        return jsonify({"success": True})
    return _error("Failed to delete case", 500)


# ── Batch Operations ────────────────────────────────────────────────────

@api_bp.route("/cases/batch", methods=["POST"])
def batch_cases():
    data = request.get_json(silent=True) or {}
    action = data.get("action", "")
    ids = data.get("case_ids", [])

    if not isinstance(ids, list):
        return _error("case_ids must be a list")

    ids = [i for i in ids if isinstance(i, str) and _valid_case_id(i)]
    if not ids:
        return _error("No valid case IDs provided")
    if len(ids) > MAX_BATCH_SIZE:
        return _error(f"Batch limited to {MAX_BATCH_SIZE} cases")

    repo = get_repo()
    count = 0

    if action == "tag":
        tag = (data.get("tag") or "").strip().replace(",", "").replace("<", "").replace(">", "")
        if not tag:
            return _error("No tag provided")
        if len(tag) > MAX_TAG_LENGTH:
            return _error(f"Tag must be {MAX_TAG_LENGTH} characters or less")
        for cid in ids:
            case = repo.get_by_id(cid)
            if case:
                existing = {t.strip() for t in case.tags.split(",") if t.strip()} if case.tags else set()
                if tag not in existing:
                    existing.add(tag)
                    repo.update(cid, {"tags": ", ".join(sorted(existing))})
                    count += 1

    elif action == "delete":
        for cid in ids:
            if repo.delete(cid):
                count += 1

    else:
        return _error(f"Unknown action: {action}")

    return jsonify({"affected": count})


# ── Compare ─────────────────────────────────────────────────────────────

@api_bp.route("/cases/compare")
def compare_cases():
    ids = request.args.getlist("ids")
    ids = [i for i in ids if _valid_case_id(i)]
    if len(ids) < 2:
        return _error("At least 2 case IDs required")
    ids = ids[:3]

    repo = get_repo()
    cases = []
    for cid in ids:
        case = repo.get_by_id(cid)
        if case:
            cases.append(case.to_dict())

    if len(cases) < 2:
        return _error("Could not find enough cases", 404)

    return jsonify({"cases": cases})


# ── Related Cases ───────────────────────────────────────────────────────

@api_bp.route("/cases/<case_id>/related")
def related_cases(case_id):
    if not _valid_case_id(case_id):
        return _error("Invalid case ID")
    repo = get_repo()
    related = repo.find_related(case_id, limit=5)
    return jsonify({"cases": [c.to_dict() for c in related]})


# ── Full-Text Search ────────────────────────────────────────────────────

@api_bp.route("/search")
def search():
    query = request.args.get("q", "").strip()
    limit = safe_int(request.args.get("limit"), default=50, min_val=1, max_val=200)
    if not query:
        return jsonify({"cases": []})
    repo = get_repo()
    results = repo.search_text(query, limit=limit)
    return jsonify({"cases": [c.to_dict() for c in results]})


# ── Filter Options ──────────────────────────────────────────────────────

@api_bp.route("/filter-options")
def filter_options():
    repo = get_repo()
    opts = repo.get_filter_options()
    return jsonify(opts)


# ── Export ──────────────────────────────────────────────────────────────

@api_bp.route("/export/csv")
def export_csv():
    repo = get_repo()
    cases = _filter_cases(repo.load_all(), request.args)
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


@api_bp.route("/export/json")
def export_json():
    repo = get_repo()
    cases = _filter_cases(repo.load_all(), request.args)
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


# ── Job Status ──────────────────────────────────────────────────────────

@api_bp.route("/job-status")
def job_status():
    with _job_lock:
        snapshot = dict(_job_status)
    return jsonify(snapshot)


# ── Search Job ──────────────────────────────────────────────────────────

@api_bp.route("/search/start", methods=["POST"])
def start_search():
    with _job_lock:
        if _job_status["running"]:
            return _error("A job is already running")

    data = request.get_json(silent=True) or {}
    databases = data.get("databases", ["AATA", "ARTA", "FCA"])
    start_year = safe_int(data.get("start_year"), default=START_YEAR, min_val=2000, max_val=2030)
    end_year = safe_int(data.get("end_year"), default=END_YEAR, min_val=2000, max_val=2030)
    max_results = safe_int(data.get("max_results"), default=500, min_val=1, max_val=50000)
    search_fedcourt = data.get("search_fedcourt", False)

    thread = threading.Thread(
        target=_run_search_job,
        args=(databases, start_year, end_year, max_results, search_fedcourt),
        kwargs={"output_dir": get_output_dir(), "repo": get_repo()},
        daemon=True,
    )
    thread.start()
    return jsonify({"started": True})


# ── Download Job ────────────────────────────────────────────────────────

@api_bp.route("/download/start", methods=["POST"])
def start_download():
    with _job_lock:
        if _job_status["running"]:
            return _error("A job is already running")

    data = request.get_json(silent=True) or {}
    court_filter = data.get("court", "")
    limit = safe_int(data.get("limit"), default=50, min_val=1, max_val=10000)

    thread = threading.Thread(
        target=_run_download_job,
        args=(court_filter, limit),
        kwargs={"output_dir": get_output_dir(), "repo": get_repo()},
        daemon=True,
    )
    thread.start()
    return jsonify({"started": True})


# ── Update DB Job ───────────────────────────────────────────────────────

@api_bp.route("/update-db/start", methods=["POST"])
def start_update_db():
    with _job_lock:
        if _job_status["running"]:
            return _error("A job is already running")

    data = request.get_json(silent=True) or {}
    databases = data.get("databases", ["AATA", "ARTA", "FCA", "FCCA", "FedCFamC2G", "HCA"])
    delay = safe_float(data.get("delay"), default=0.5, min_val=0.3, max_val=5.0)

    thread = threading.Thread(
        target=_run_update_job,
        args=("custom",),
        kwargs={
            "databases": databases,
            "start_year": END_YEAR,
            "end_year": END_YEAR,
            "delay": delay,
            "output_dir": get_output_dir(),
            "repo": get_repo(),
        },
        daemon=True,
    )
    thread.start()
    return jsonify({"started": True})


# ── Pipeline ────────────────────────────────────────────────────────────

@api_bp.route("/pipeline-status")
def pipeline_status():
    from ...pipeline import get_pipeline_status
    return jsonify(get_pipeline_status())


@api_bp.route("/pipeline-action", methods=["POST"])
@csrf.exempt
def pipeline_action():
    from ...pipeline import request_pipeline_stop, get_pipeline_status
    from ...pipeline import PipelineConfig, start_pipeline

    data = request.get_json(silent=True) or {}
    action = data.get("action", "")

    if action == "stop":
        request_pipeline_stop()
        return jsonify({"ok": True, "message": "Stop requested."})

    if action == "start":
        ps = get_pipeline_status()
        if ps.get("running"):
            return _error("Pipeline is already running")
        with _job_lock:
            if _job_status["running"]:
                return _error("Another job is running")

        config = PipelineConfig(
            databases=data.get("databases", ["AATA", "ARTA", "FCA"]),
            start_year=safe_int(data.get("start_year"), default=START_YEAR, min_val=2000, max_val=2030),
            end_year=safe_int(data.get("end_year"), default=END_YEAR, min_val=2000, max_val=2030),
        )
        out = get_output_dir()
        if start_pipeline(config, out):
            return jsonify({"ok": True, "message": "Pipeline started."})
        return _error("Failed to start pipeline", 500)

    return _error(f"Unknown action: {action}")


# ── Data Dictionary ─────────────────────────────────────────────────────

@api_bp.route("/data-dictionary")
def data_dictionary():
    return jsonify({"fields": DATA_DICTIONARY_FIELDS})
