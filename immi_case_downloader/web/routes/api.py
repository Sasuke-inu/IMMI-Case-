"""JSON API endpoints for the React SPA frontend.

All endpoints are prefixed with /api/v1/.
Reuses existing CaseRepository methods — no new backend logic.
"""

import io
import csv
import re
import json
import time
import threading
from itertools import combinations
from collections import Counter, defaultdict
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

# ── Outcome normalisation ──────────────────────────────────────────────

_OUTCOME_MAP = {
    "affirm": "Affirmed",
    "dismiss": "Dismissed",
    "remit": "Remitted",
    "set aside": "Set Aside",
    "allow": "Allowed",
    "refus": "Refused",
    "withdrawn": "Withdrawn",
    "discontinu": "Withdrawn",
}

TRIBUNAL_CODES = {"AATA", "ARTA", "MRTA", "RRTA"}
COURT_CODES = {"FCA", "FCCA", "FMCA", "FedCFamC2G", "HCA"}
_TRIBUNAL_WIN_OUTCOMES = ("Remitted", "Set Aside")
_COURT_WIN_OUTCOMES = ("Allowed", "Set Aside")
_MIXED_WIN_OUTCOMES = ("Allowed", "Remitted", "Set Aside")
_JUDGE_BLOCKLIST = frozenset(
    {
        "date",
        "the",
        "and",
        "court",
        "tribunal",
        "member",
        "judge",
        "justice",
        "honour",
        "federal",
        "migration",
        "review",
        "applicant",
        "respondent",
        "minister",
        "decision",
    }
)


def _normalise_outcome(raw: str) -> str:
    """Map raw outcome text to one of 8 standard categories."""
    if not raw:
        return "Other"
    low = raw.lower().strip()
    for keyword, label in _OUTCOME_MAP.items():
        if keyword in low:
            return label
    return "Other"


def _split_concepts(raw: str) -> list[str]:
    if not raw:
        return []
    parts = re.split(r"[;,]", raw)
    out: list[str] = []
    seen: set[str] = set()
    for part in parts:
        concept = part.strip().lower()
        if not concept or len(concept) < 2 or concept in seen:
            continue
        seen.add(concept)
        out.append(concept)
    return out


def _split_judges(raw: str) -> list[str]:
    if not raw:
        return []
    names: list[str] = []
    seen: set[str] = set()
    for piece in re.split(r"[;,]", raw):
        name = piece.strip()
        lowered = name.lower()
        if (
            not name
            or len(name) < 3
            or lowered in _JUDGE_BLOCKLIST
            or name.isdigit()
            or lowered in seen
        ):
            continue
        seen.add(lowered)
        names.append(name)
    return names


def _determine_court_type(court_codes: set[str]) -> str:
    if not court_codes:
        return "unknown"
    has_tribunal = any(code in TRIBUNAL_CODES for code in court_codes)
    has_court = any(code in COURT_CODES for code in court_codes)
    if has_tribunal and not has_court:
        return "tribunal"
    if has_court and not has_tribunal:
        return "court"
    return "mixed"


def _win_outcomes_for_court_type(court_type: str) -> list[str]:
    if court_type == "tribunal":
        return list(_TRIBUNAL_WIN_OUTCOMES)
    if court_type == "court":
        return list(_COURT_WIN_OUTCOMES)
    return list(_MIXED_WIN_OUTCOMES)


def _is_win(normalised_outcome: str, court_code: str) -> bool:
    if court_code in TRIBUNAL_CODES:
        return normalised_outcome in _TRIBUNAL_WIN_OUTCOMES
    if court_code in COURT_CODES:
        return normalised_outcome in _COURT_WIN_OUTCOMES
    return normalised_outcome in _MIXED_WIN_OUTCOMES


def _round_rate(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100.0, 1)


def _judge_profile_payload(
    name: str, judge_cases: list[ImmigrationCase], include_recent_cases: bool = True
) -> dict:
    total = len(judge_cases)
    if total == 0:
        payload = {
            "judge": {
                "name": name,
                "total_cases": 0,
                "courts": [],
                "active_years": {"first": None, "last": None},
            },
            "approval_rate": 0.0,
            "court_type": "unknown",
            "outcome_distribution": {},
            "visa_breakdown": [],
            "concept_effectiveness": [],
            "yearly_trend": [],
            "nature_breakdown": [],
        }
        if include_recent_cases:
            payload["recent_cases"] = []
        return payload

    wins = 0
    outcome_distribution: Counter = Counter()
    court_counter: Counter = Counter()
    year_totals: Counter = Counter()
    year_wins: Counter = Counter()
    visa_totals: Counter = Counter()
    visa_wins: Counter = Counter()
    nature_totals: Counter = Counter()
    nature_wins: Counter = Counter()
    concept_totals: Counter = Counter()
    concept_wins: Counter = Counter()

    years = [c.year for c in judge_cases if c.year]

    for case in judge_cases:
        if case.court_code:
            court_counter[case.court_code] += 1
        norm = _normalise_outcome(case.outcome)
        outcome_distribution[norm] += 1
        won = _is_win(norm, case.court_code)
        if won:
            wins += 1
        if case.year:
            year_totals[case.year] += 1
            if won:
                year_wins[case.year] += 1
        if case.visa_subclass:
            visa_totals[case.visa_subclass] += 1
            if won:
                visa_wins[case.visa_subclass] += 1
        if case.case_nature:
            nature_totals[case.case_nature] += 1
            if won:
                nature_wins[case.case_nature] += 1
        for concept in _split_concepts(case.legal_concepts):
            concept_totals[concept] += 1
            if won:
                concept_wins[concept] += 1

    approval_rate = _round_rate(wins, total)
    courts = sorted(court_counter.keys())
    court_type = _determine_court_type(set(courts))

    visa_breakdown = [
        {
            "subclass": subclass,
            "total": count,
            "win_rate": _round_rate(visa_wins[subclass], count),
        }
        for subclass, count in sorted(
            visa_totals.items(), key=lambda item: item[1], reverse=True
        )
    ]

    nature_breakdown = [
        {
            "nature": nature,
            "total": count,
            "win_rate": _round_rate(nature_wins[nature], count),
        }
        for nature, count in sorted(
            nature_totals.items(), key=lambda item: item[1], reverse=True
        )
    ]

    concept_effectiveness = []
    for concept, count in concept_totals.most_common(30):
        win_rate = _round_rate(concept_wins[concept], count)
        concept_effectiveness.append(
            {
                "concept": concept,
                "total": count,
                "win_rate": win_rate,
                "baseline_rate": approval_rate,
                "lift": round((win_rate / approval_rate), 2) if approval_rate > 0 else 0.0,
            }
        )

    yearly_trend = [
        {
            "year": year,
            "total": year_totals[year],
            "approval_rate": _round_rate(year_wins[year], year_totals[year]),
        }
        for year in sorted(year_totals.keys())
    ]

    payload = {
        "judge": {
            "name": name,
            "total_cases": total,
            "courts": courts,
            "active_years": {
                "first": min(years) if years else None,
                "last": max(years) if years else None,
            },
        },
        "approval_rate": approval_rate,
        "court_type": court_type,
        "outcome_distribution": dict(outcome_distribution),
        "visa_breakdown": visa_breakdown,
        "concept_effectiveness": concept_effectiveness,
        "yearly_trend": yearly_trend,
        "nature_breakdown": nature_breakdown,
    }

    if include_recent_cases:
        recent_sorted = sorted(
            judge_cases,
            key=lambda c: (c.year or 0, c.date or ""),
            reverse=True,
        )[:10]
        payload["recent_cases"] = [
            {
                "case_id": c.case_id,
                "citation": c.citation,
                "date": c.date,
                "outcome": c.outcome,
                "visa_subclass": c.visa_subclass,
            }
            for c in recent_sorted
        ]

    return payload


# ── Cached load_all with year/court filtering ──────────────────────────

_all_cases_cache: list[ImmigrationCase] = []
_all_cases_ts: float = 0.0
_all_cases_lock = threading.Lock()
_CACHE_TTL = 60.0


def _get_all_cases() -> list[ImmigrationCase]:
    """Return repo.load_all() with 60-second in-memory cache."""
    global _all_cases_cache, _all_cases_ts
    now = time.time()
    if _all_cases_cache and (now - _all_cases_ts) < _CACHE_TTL:
        return _all_cases_cache
    with _all_cases_lock:
        # Double-check after acquiring lock (another thread may have refreshed)
        if _all_cases_cache and (time.time() - _all_cases_ts) < _CACHE_TTL:
            return _all_cases_cache
        repo = get_repo()
        _all_cases_cache = repo.load_all()
        _all_cases_ts = time.time()
        return _all_cases_cache


def _apply_filters(cases: list[ImmigrationCase]) -> list[ImmigrationCase]:
    """Apply ?court=&year_from=&year_to= query params to a case list."""
    court = request.args.get("court", "").strip()
    year_from = safe_int(request.args.get("year_from"), default=0, min_val=0, max_val=2100)
    year_to = safe_int(request.args.get("year_to"), default=0, min_val=0, max_val=2100)

    if court:
        cases = [c for c in cases if c.court_code == court]
    if year_from:
        cases = [c for c in cases if c.year and c.year >= year_from]
    if year_to:
        cases = [c for c in cases if c.year and c.year <= year_to]
    return cases

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
    {"name": "visa_subclass", "type": "string", "description": "Visa subclass number", "example": "866"},
    {"name": "visa_class_code", "type": "string", "description": "Visa class code letter", "example": "XA"},
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
    court = request.args.get("court", "").strip()
    year_from = safe_int(request.args.get("year_from"), default=0, min_val=0, max_val=2100)
    year_to = safe_int(request.args.get("year_to"), default=0, min_val=0, max_val=2100)

    # Treat full 2000–current_year range as "no filter" to use optimised path
    is_full_range = (not court
                     and (not year_from or year_from <= 2000)
                     and (not year_to or year_to >= END_YEAR))

    # If filters are active, compute stats from filtered load_all
    if not is_full_range:
        cases = _apply_filters(_get_all_cases())
        by_court: dict[str, int] = Counter(c.court_code for c in cases if c.court_code)
        by_year: dict[int, int] = Counter(c.year for c in cases if c.year)
        by_nature: dict[str, int] = Counter(c.case_nature for c in cases if c.case_nature)
        by_visa: dict[str, int] = Counter(c.visa_subclass for c in cases if c.visa_subclass)
        with_text = sum(1 for c in cases if c.full_text_path)
        sources: dict[str, int] = Counter(c.source for c in cases if c.source)

        recent_sorted = sorted(
            [c for c in cases if c.date],
            key=lambda c: c.date,
            reverse=True,
        )[:5]
        recent = [
            {
                "case_id": c.case_id, "title": c.title, "citation": c.citation,
                "court_code": c.court_code, "date": c.date, "outcome": c.outcome,
            }
            for c in recent_sorted
        ]

        return jsonify({
            "total_cases": len(cases),
            "with_full_text": with_text,
            "courts": dict(by_court),
            "years": {str(k): v for k, v in sorted(by_year.items())},
            "natures": dict(by_nature),
            "visa_subclasses": dict(by_visa),
            "sources": dict(sources),
            "recent_cases": recent,
        })

    # Unfiltered: use repository's optimised get_statistics
    repo = get_repo()
    s = repo.get_statistics()

    sources_dict = s.get("by_source", {})
    if not sources_dict:
        sources_dict = {src: 0 for src in s.get("sources", [])}

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
        "courts": s.get("by_court", {}),
        "years": s.get("by_year", {}),
        "natures": s.get("by_nature", {}),
        "visa_subclasses": s.get("by_visa_subclass", {}),
        "sources": sources_dict,
        "recent_cases": recent,
    })


@api_bp.route("/stats/trends")
def stats_trends():
    """Court x year cross-tabulation for trend chart."""
    court = request.args.get("court", "").strip()
    year_from = safe_int(request.args.get("year_from"), default=0, min_val=0, max_val=2100)
    year_to = safe_int(request.args.get("year_to"), default=0, min_val=0, max_val=2100)

    # Treat full 2000–current_year range as "no filter"
    is_full_range = (not court
                     and (not year_from or year_from <= 2000)
                     and (not year_to or year_to >= END_YEAR))

    # Supabase RPC for unfiltered requests
    if is_full_range:
        repo = get_repo()
        if hasattr(repo, "_client"):
            try:
                resp = repo._client.rpc("get_court_year_trends").execute()
                return jsonify({"trends": resp.data or []})
            except Exception:
                pass

    all_cases = _apply_filters(_get_all_cases())

    year_court_counts: dict[int, dict[str, int]] = {}
    for c in all_cases:
        if c.year and c.court_code:
            if c.year not in year_court_counts:
                year_court_counts[c.year] = {}
            ycc = year_court_counts[c.year]
            ycc[c.court_code] = ycc.get(c.court_code, 0) + 1

    trends = [{"year": year, **year_court_counts[year]} for year in sorted(year_court_counts.keys())]

    return jsonify({"trends": trends})


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
    sort_by = request.args.get("sort_by", "date")
    sort_dir = request.args.get("sort_dir", "desc")
    page = safe_int(request.args.get("page"), default=1, min_val=1)
    page_size = safe_int(request.args.get("page_size"), default=100, min_val=1, max_val=200)

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
            "start_year": END_YEAR - 1,
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


# ── Analytics ──────────────────────────────────────────────────────────

@api_bp.route("/analytics/outcomes")
def analytics_outcomes():
    """Outcome rates by court, year, and visa subclass."""
    cases = _apply_filters(_get_all_cases())

    by_court: dict[str, dict[str, int]] = defaultdict(Counter)
    by_year: dict[int, dict[str, int]] = defaultdict(Counter)
    by_subclass: dict[str, dict[str, int]] = defaultdict(Counter)

    for c in cases:
        norm = _normalise_outcome(c.outcome)
        if c.court_code:
            by_court[c.court_code][norm] += 1
        if c.year:
            by_year[c.year][norm] += 1
        if c.visa_subclass:
            by_subclass[c.visa_subclass][norm] += 1

    return jsonify({
        "by_court": {k: dict(v) for k, v in sorted(by_court.items())},
        "by_year": {str(k): dict(v) for k, v in sorted(by_year.items())},
        "by_subclass": {k: dict(v) for k, v in sorted(by_subclass.items(), key=lambda x: sum(x[1].values()), reverse=True)},
    })


@api_bp.route("/analytics/judges")
def analytics_judges():
    """Top judges/members by case count."""
    limit = safe_int(request.args.get("limit"), default=20, min_val=1, max_val=100)
    cases = _apply_filters(_get_all_cases())

    judge_counter: Counter = Counter()
    judge_courts: dict[str, set[str]] = defaultdict(set)

    for c in cases:
        for name in _split_judges(c.judges):
            judge_counter[name] += 1
            if c.court_code:
                judge_courts[name].add(c.court_code)

    judges = [
        {"name": name, "count": count, "courts": sorted(judge_courts.get(name, set()))}
        for name, count in judge_counter.most_common(limit)
    ]

    return jsonify({"judges": judges})


@api_bp.route("/analytics/legal-concepts")
def analytics_legal_concepts():
    """Top legal concepts by frequency."""
    limit = safe_int(request.args.get("limit"), default=20, min_val=1, max_val=100)
    cases = _apply_filters(_get_all_cases())

    concept_counter: Counter = Counter()
    for c in cases:
        if not c.legal_concepts:
            continue
        for concept in re.split(r"[;,]", c.legal_concepts):
            term = concept.strip().lower()
            if term and len(term) > 2:
                concept_counter[term] += 1

    concepts = [
        {"name": name, "count": count}
        for name, count in concept_counter.most_common(limit)
    ]

    return jsonify({"concepts": concepts})


@api_bp.route("/analytics/nature-outcome")
def analytics_nature_outcome():
    """Nature x Outcome cross-tabulation matrix."""
    cases = _apply_filters(_get_all_cases())

    nature_outcome: dict[str, dict[str, int]] = defaultdict(Counter)
    for c in cases:
        if not c.case_nature:
            continue
        norm = _normalise_outcome(c.outcome)
        nature_outcome[c.case_nature][norm] += 1

    # Get top natures by total count
    nature_totals = {n: sum(outcomes.values()) for n, outcomes in nature_outcome.items()}
    top_natures = sorted(nature_totals, key=nature_totals.get, reverse=True)[:20]

    # Collect all outcome labels
    all_outcomes = set()
    for outcomes in nature_outcome.values():
        all_outcomes.update(outcomes.keys())
    outcome_labels = sorted(all_outcomes)

    matrix: dict[str, dict[str, int]] = {}
    for nature in top_natures:
        matrix[nature] = {o: nature_outcome[nature].get(o, 0) for o in outcome_labels}

    return jsonify({
        "natures": top_natures,
        "outcomes": outcome_labels,
        "matrix": matrix,
    })


@api_bp.route("/analytics/success-rate")
def analytics_success_rate():
    """Multi-factor success-rate analytics."""
    cases = _apply_filters(_get_all_cases())

    visa_subclass = request.args.get("visa_subclass", "").strip()
    case_nature = request.args.get("case_nature", "").strip()
    legal_concepts_param = request.args.get("legal_concepts", "").strip()
    requested_concepts = _split_concepts(legal_concepts_param)

    if visa_subclass:
        cases = [c for c in cases if (c.visa_subclass or "").strip() == visa_subclass]
    if case_nature:
        target_nature = case_nature.lower()
        cases = [c for c in cases if (c.case_nature or "").strip().lower() == target_nature]
    if requested_concepts:
        required = set(requested_concepts)
        cases = [
            c
            for c in cases
            if required.issubset(set(_split_concepts(c.legal_concepts)))
        ]

    total = len(cases)
    wins = 0
    year_totals: Counter = Counter()
    year_wins: Counter = Counter()
    concept_totals: Counter = Counter()
    concept_wins: Counter = Counter()

    for case in cases:
        norm = _normalise_outcome(case.outcome)
        won = _is_win(norm, case.court_code)
        if won:
            wins += 1

        if case.year:
            year_totals[case.year] += 1
            if won:
                year_wins[case.year] += 1

        for concept in _split_concepts(case.legal_concepts):
            concept_totals[concept] += 1
            if won:
                concept_wins[concept] += 1

    losses = max(0, total - wins)
    overall_rate = _round_rate(wins, total)
    confidence = "low"
    if total > 100:
        confidence = "high"
    elif total >= 20:
        confidence = "medium"

    court_type = _determine_court_type({c.court_code for c in cases if c.court_code})
    win_outcomes = _win_outcomes_for_court_type(court_type)

    by_concept = []
    for concept, count in concept_totals.most_common(30):
        win_rate = _round_rate(concept_wins[concept], count)
        by_concept.append(
            {
                "concept": concept,
                "total": count,
                "win_rate": win_rate,
                "lift": round((win_rate / overall_rate), 2) if overall_rate > 0 else 0.0,
            }
        )

    top_combo_candidates = set(name for name, _ in concept_totals.most_common(15))
    combo_totals: Counter = Counter()
    combo_wins: Counter = Counter()
    for case in cases:
        case_concepts = sorted(
            set(_split_concepts(case.legal_concepts)).intersection(top_combo_candidates)
        )
        if len(case_concepts) < 2:
            continue
        won = _is_win(_normalise_outcome(case.outcome), case.court_code)
        for size in (2, 3):
            if len(case_concepts) < size:
                continue
            for combo in combinations(case_concepts, size):
                combo_totals[combo] += 1
                if won:
                    combo_wins[combo] += 1

    top_combos = []
    for combo, count in combo_totals.items():
        if count < 2:
            continue
        win_rate = _round_rate(combo_wins[combo], count)
        top_combos.append(
            {
                "concepts": list(combo),
                "win_rate": win_rate,
                "count": count,
                "lift": round((win_rate / overall_rate), 2) if overall_rate > 0 else 0.0,
            }
        )

    top_combos.sort(key=lambda item: (item["lift"], item["count"]), reverse=True)
    top_combos = top_combos[:20]

    trend = [
        {
            "year": year,
            "rate": _round_rate(year_wins[year], year_totals[year]),
            "count": year_totals[year],
        }
        for year in sorted(year_totals.keys())
    ]

    return jsonify(
        {
            "query": {
                "court": request.args.get("court", "").strip() or None,
                "year_from": safe_int(request.args.get("year_from"), default=0, min_val=0, max_val=2100) or None,
                "year_to": safe_int(request.args.get("year_to"), default=0, min_val=0, max_val=2100) or None,
                "visa_subclass": visa_subclass or None,
                "case_nature": case_nature or None,
                "legal_concepts": requested_concepts,
                "total_matching": total,
            },
            "success_rate": {
                "overall": overall_rate,
                "court_type": court_type,
                "win_outcomes": win_outcomes,
                "win_count": wins,
                "loss_count": losses,
                "confidence": confidence,
            },
            "by_concept": by_concept,
            "top_combos": top_combos,
            "trend": trend,
        }
    )


@api_bp.route("/analytics/judge-leaderboard")
def analytics_judge_leaderboard():
    """Judge/member leaderboard with approval rates and metadata."""
    sort_by = request.args.get("sort_by", "cases").strip().lower() or "cases"
    limit = safe_int(request.args.get("limit"), default=50, min_val=1, max_val=200)
    cases = _apply_filters(_get_all_cases())

    judge_cases: dict[str, list[ImmigrationCase]] = defaultdict(list)
    judge_court_counts: dict[str, Counter] = defaultdict(Counter)
    judge_display_name: dict[str, str] = {}  # lowered → first-seen original name
    for case in cases:
        for name in _split_judges(case.judges):
            key = name.lower()
            if key not in judge_display_name:
                judge_display_name[key] = name
            judge_cases[key].append(case)
            if case.court_code:
                judge_court_counts[key][case.court_code] += 1

    rows = []
    for key, jc in judge_cases.items():
        display_name = judge_display_name[key]
        profile = _judge_profile_payload(display_name, jc, include_recent_cases=False)
        top_visa_subclasses = [
            {"subclass": item["subclass"], "count": item["total"]}
            for item in profile["visa_breakdown"][:3]
        ]
        primary_court = None
        if judge_court_counts[key]:
            primary_court = judge_court_counts[key].most_common(1)[0][0]

        rows.append(
            {
                "name": display_name,
                "total_cases": profile["judge"]["total_cases"],
                "approval_rate": profile["approval_rate"],
                "courts": profile["judge"]["courts"],
                "primary_court": primary_court,
                "top_visa_subclasses": top_visa_subclasses,
                "active_years": profile["judge"]["active_years"],
                "outcome_summary": profile["outcome_distribution"],
            }
        )

    if sort_by == "approval_rate":
        rows.sort(key=lambda row: (row["approval_rate"], row["total_cases"]), reverse=True)
    elif sort_by == "name":
        rows.sort(key=lambda row: row["name"].lower())
    else:
        rows.sort(key=lambda row: (row["total_cases"], row["approval_rate"]), reverse=True)

    total_judges = len(rows)
    return jsonify({"judges": rows[:limit], "total_judges": total_judges})


@api_bp.route("/analytics/judge-profile")
def analytics_judge_profile():
    """Deep profile for a single judge/member."""
    name = request.args.get("name", "").strip()
    if not name:
        return _error("name query parameter is required")

    cases = _apply_filters(_get_all_cases())
    lowered_name = name.lower()
    judge_cases = [
        c
        for c in cases
        if lowered_name in {j.lower() for j in _split_judges(c.judges)}
    ]

    payload = _judge_profile_payload(name, judge_cases, include_recent_cases=True)
    return jsonify(payload)


@api_bp.route("/analytics/judge-compare")
def analytics_judge_compare():
    """Compare 2-4 judges side-by-side."""
    raw_names = request.args.get("names", "")
    names = []
    for part in raw_names.split(","):
        name = part.strip()
        if name and name not in names:
            names.append(name)

    if len(names) < 2:
        return _error("At least two judge names are required")

    names = names[:4]
    cases = _apply_filters(_get_all_cases())

    profiles = []
    for name in names:
        lowered_name = name.lower()
        judge_cases = [
            c
            for c in cases
            if lowered_name in {j.lower() for j in _split_judges(c.judges)}
        ]
        profiles.append(
            _judge_profile_payload(name, judge_cases, include_recent_cases=False)
        )

    return jsonify({"judges": profiles})


@api_bp.route("/analytics/concept-effectiveness")
def analytics_concept_effectiveness():
    """Per-concept win-rate and lift vs baseline."""
    limit = safe_int(request.args.get("limit"), default=30, min_val=1, max_val=100)
    cases = _apply_filters(_get_all_cases())

    baseline_wins = 0
    concept_totals: Counter = Counter()
    concept_wins: Counter = Counter()
    by_court_totals: dict[str, Counter] = defaultdict(Counter)
    by_court_wins: dict[str, Counter] = defaultdict(Counter)

    for case in cases:
        norm = _normalise_outcome(case.outcome)
        won = _is_win(norm, case.court_code)
        if won:
            baseline_wins += 1
        concepts = set(_split_concepts(case.legal_concepts))
        for concept in concepts:
            concept_totals[concept] += 1
            if won:
                concept_wins[concept] += 1
            if case.court_code:
                by_court_totals[concept][case.court_code] += 1
                if won:
                    by_court_wins[concept][case.court_code] += 1

    baseline_rate = _round_rate(baseline_wins, len(cases))
    concepts = []
    for concept, total in concept_totals.most_common(limit):
        win_rate = _round_rate(concept_wins[concept], total)
        court_breakdown = {}
        for court_code, court_total in by_court_totals[concept].items():
            court_breakdown[court_code] = {
                "total": court_total,
                "win_rate": _round_rate(by_court_wins[concept][court_code], court_total),
            }
        concepts.append(
            {
                "name": concept,
                "total": total,
                "win_rate": win_rate,
                "lift": round((win_rate / baseline_rate), 2) if baseline_rate > 0 else 0.0,
                "by_court": court_breakdown,
            }
        )

    return jsonify({"baseline_rate": baseline_rate, "concepts": concepts})


@api_bp.route("/analytics/concept-cooccurrence")
def analytics_concept_cooccurrence():
    """Concept co-occurrence matrix and top pairs."""
    limit = safe_int(request.args.get("limit"), default=15, min_val=2, max_val=30)
    min_count = safe_int(request.args.get("min_count"), default=50, min_val=1, max_val=1000000)
    cases = _apply_filters(_get_all_cases())

    concept_frequency: Counter = Counter()
    baseline_wins = 0
    for case in cases:
        concepts = set(_split_concepts(case.legal_concepts))
        for concept in concepts:
            concept_frequency[concept] += 1
        if _is_win(_normalise_outcome(case.outcome), case.court_code):
            baseline_wins += 1

    top_concepts = [name for name, _ in concept_frequency.most_common(limit)]
    top_set = set(top_concepts)

    pair_totals: Counter = Counter()
    pair_wins: Counter = Counter()
    for case in cases:
        concepts = sorted(set(_split_concepts(case.legal_concepts)).intersection(top_set))
        if len(concepts) < 2:
            continue
        won = _is_win(_normalise_outcome(case.outcome), case.court_code)
        for a, b in combinations(concepts, 2):
            pair = (a, b)
            pair_totals[pair] += 1
            if won:
                pair_wins[pair] += 1

    baseline_rate = _round_rate(baseline_wins, len(cases))
    matrix: dict[str, dict[str, dict[str, float | int]]] = defaultdict(dict)
    top_pairs = []
    for pair, count in pair_totals.items():
        if count < min_count:
            continue
        a, b = pair
        win_rate = _round_rate(pair_wins[pair], count)
        cell = {"count": count, "win_rate": win_rate}
        matrix[a][b] = cell
        matrix[b][a] = cell
        top_pairs.append(
            {
                "a": a,
                "b": b,
                "count": count,
                "win_rate": win_rate,
                "lift": round((win_rate / baseline_rate), 2) if baseline_rate > 0 else 0.0,
            }
        )

    top_pairs.sort(key=lambda item: item["count"], reverse=True)
    return jsonify(
        {
            "concepts": top_concepts,
            "matrix": dict(matrix),
            "top_pairs": top_pairs,
        }
    )


@api_bp.route("/analytics/concept-trends")
def analytics_concept_trends():
    """Time-series concept usage + emerging/declining concepts."""
    limit = safe_int(request.args.get("limit"), default=10, min_val=1, max_val=30)
    cases = _apply_filters(_get_all_cases())

    # Single-pass: collect frequency + per-concept year totals/wins
    concept_frequency: Counter = Counter()
    concept_year_totals: dict[str, Counter] = defaultdict(Counter)
    concept_year_wins: dict[str, Counter] = defaultdict(Counter)
    all_years_set: set[int] = set()

    for case in cases:
        concepts = set(_split_concepts(case.legal_concepts))
        won = _is_win(_normalise_outcome(case.outcome), case.court_code) if concepts else False
        for concept in concepts:
            concept_frequency[concept] += 1
            if case.year:
                all_years_set.add(case.year)
                concept_year_totals[concept][case.year] += 1
                if won:
                    concept_year_wins[concept][case.year] += 1

    tracked = [name for name, _ in concept_frequency.most_common(limit)]
    all_years = sorted(all_years_set)

    series = {}
    emerging = []
    declining = []
    latest_year = max(all_years) if all_years else 0
    recent_years = {latest_year, latest_year - 1}
    previous_years = {latest_year - 2, latest_year - 3}

    for concept in tracked:
        year_totals = concept_year_totals[concept]
        year_wins = concept_year_wins[concept]

        concept_points = [
            {
                "year": year,
                "count": year_totals[year],
                "win_rate": _round_rate(year_wins[year], year_totals[year]),
            }
            for year in sorted(year_totals.keys())
        ]
        if concept_points:
            series[concept] = concept_points

        recent_count = sum(year_totals[y] for y in recent_years)
        previous_count = sum(year_totals[y] for y in previous_years)
        if recent_count == 0 and previous_count == 0:
            continue

        if previous_count == 0 and recent_count > 0:
            growth_pct = 100.0
        elif previous_count == 0:
            growth_pct = 0.0
        else:
            growth_pct = round(((recent_count - previous_count) / previous_count) * 100.0, 1)

        if growth_pct > 25:
            emerging.append(
                {
                    "name": concept,
                    "growth_pct": growth_pct,
                    "recent_count": recent_count,
                }
            )
        elif growth_pct < -25:
            declining.append(
                {
                    "name": concept,
                    "decline_pct": growth_pct,
                    "recent_count": recent_count,
                }
            )

    emerging.sort(key=lambda item: item["growth_pct"], reverse=True)
    declining.sort(key=lambda item: item["decline_pct"])

    return jsonify(
        {
            "series": series,
            "emerging": emerging,
            "declining": declining,
        }
    )


# ── Data Dictionary ─────────────────────────────────────────────────────

@api_bp.route("/data-dictionary")
def data_dictionary():
    return jsonify({"fields": DATA_DICTIONARY_FIELDS})
