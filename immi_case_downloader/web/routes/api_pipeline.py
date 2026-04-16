"""Pipeline and LLM Council API endpoints.

Extracted from api.py as part of cq-001 Phase B.
Routes: /job-status, /download/start, /pipeline-status, /pipeline-action,
        /llm-council/health, /llm-council/run
"""
import logging
import re
import threading

from flask import Blueprint, request, jsonify

from ...config import START_YEAR, END_YEAR
from ...llm_council import run_immi_council, validate_council_connectivity
from ...models import ImmigrationCase
from ..helpers import get_repo, get_output_dir, safe_int, error_response as _error
from ..jobs import _run_download_job, job_manager
from ..security import rate_limit

logger = logging.getLogger(__name__)

api_pipeline_bp = Blueprint("api_pipeline", __name__, url_prefix="/api/v1")

# ── LLM Council constants ────────────────────────────────────────────────
MAX_LLM_COUNCIL_QUESTION_LEN = 8_000
MAX_LLM_COUNCIL_CONTEXT_LEN = 20_000
MAX_LLM_COUNCIL_PRECEDENT_CASES = 8

_HEX_ID = re.compile(r"^[0-9a-f]{12}$")


def _valid_case_id(case_id: str) -> bool:
    return bool(_HEX_ID.match(case_id))


# ── LLM Council private helpers ──────────────────────────────────────────

def _build_llm_case_context(case: ImmigrationCase, extra_context: str = "") -> str:
    """Build compact case context text for LLM council prompts."""
    chunks = [
        f"Case ID: {case.case_id}",
        f"Citation: {case.citation or ''}",
        f"Title: {case.title or ''}",
        f"Court: {case.court_code or case.court or ''}",
        f"Date: {case.date or ''}",
        f"Outcome: {case.outcome or ''}",
        f"Visa Subclass: {case.visa_subclass or case.visa_type or ''}",
        f"Case Nature: {case.case_nature or ''}",
        f"Legal Concepts: {case.legal_concepts or ''}",
        f"Catchwords: {case.catchwords or ''}",
        f"Text Snippet: {case.text_snippet or ''}",
    ]
    if extra_context:
        chunks.append(f"User Context: {extra_context}")
    joined = "\n".join(chunk.strip() for chunk in chunks if chunk and chunk.strip())
    return joined[:MAX_LLM_COUNCIL_CONTEXT_LEN]


def _safe_case_year(case: ImmigrationCase) -> int:
    try:
        return int(case.year or 0)
    except (TypeError, ValueError):
        return 0


def _score_precedent_case(case: ImmigrationCase, query: str) -> int:
    """Lightweight lexical relevance score for council precedent context."""
    tokens = [t for t in re.split(r"[^a-z0-9]+", query.lower()) if len(t) >= 3]
    if not tokens:
        return 0
    fields = [
        case.title,
        case.citation,
        case.case_nature,
        case.legal_concepts,
        case.catchwords,
        case.visa_subclass,
        case.visa_type,
        case.outcome,
        case.text_snippet,
    ]
    haystack = " | ".join((f or "").lower() for f in fields)
    score = 0
    for token in tokens:
        if token in haystack:
            score += 1
    if case.legal_concepts:
        score += 1
    if case.citation:
        score += 1
    return score


def _find_llm_precedents(
    question: str,
    case_id: str = "",
    limit: int = MAX_LLM_COUNCIL_PRECEDENT_CASES,
    case_facts: str = "",
) -> list[ImmigrationCase]:
    """Find relevant precedent cases from local repository for council grounding."""
    repo = get_repo()
    if not hasattr(repo, "search_text"):
        return []

    query_text = " ".join(
        part.strip()
        for part in [question, case_facts]
        if part and part.strip()
    ).strip()
    if not query_text:
        return []

    try:
        lexical = repo.search_text(query_text, limit=max(40, limit * 6))  # type: ignore[attr-defined]
    except Exception:
        return []
    if not lexical:
        return []

    scored: list[tuple[int, int, ImmigrationCase]] = []
    for case in lexical:
        if not case or not case.case_id:
            continue
        if case_id and case.case_id == case_id:
            continue
        score = _score_precedent_case(case, query_text)
        if score <= 0:
            continue
        scored.append((score, _safe_case_year(case), case))

    if not scored:
        return []

    scored.sort(key=lambda item: (-item[0], -item[1]))
    deduped: list[ImmigrationCase] = []
    seen: set[str] = set()
    for _, _, case in scored:
        if case.case_id in seen:
            continue
        seen.add(case.case_id)
        deduped.append(case)
        if len(deduped) >= limit:
            break
    return deduped


def _build_llm_precedent_context(precedents: list[ImmigrationCase]) -> str:
    if not precedents:
        return ""
    lines: list[str] = [
        "Relevant precedent candidates from local IMMI-Case dataset:",
    ]
    for idx, case in enumerate(precedents, start=1):
        lines.append(
            (
                f"{idx}. [{case.case_id}] {case.citation or 'No citation'} | "
                f"{case.title or 'Untitled'} | "
                f"Court: {case.court_code or case.court or 'Unknown'} | "
                f"Outcome: {case.outcome or 'Unknown'} | "
                f"Legal Concepts: {case.legal_concepts or 'N/A'} | "
                f"Date: {case.date or str(_safe_case_year(case) or '')}"
            ).strip()
        )
    return "\n".join(lines).strip()


# ── Job Status ──────────────────────────────────────────────────────────

@api_pipeline_bp.route("/job-status")
def job_status():
    return jsonify(job_manager.snapshot())


# ── Download Job ────────────────────────────────────────────────────────

@api_pipeline_bp.route("/download/start", methods=["POST"])
@rate_limit(5, 60, scope="download-start")
def start_download():
    if not job_manager.reserve(
        {
            "running": True,
            "type": "download",
            "progress": "Preparing download job...",
            "total": 0,
            "completed": 0,
            "errors": [],
            "results": [],
        },
    ):
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
    try:
        thread.start()
    except Exception:
        job_manager.reset()
        raise
    return jsonify({"started": True})


# ── Pipeline ────────────────────────────────────────────────────────────

@api_pipeline_bp.route("/pipeline-status")
def pipeline_status():
    from ...pipeline import get_pipeline_status
    return jsonify(get_pipeline_status())


@api_pipeline_bp.route("/pipeline-action", methods=["POST"])
@rate_limit(10, 60, scope="pipeline-action")
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
        if job_manager.is_running():
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


# ── LLM Council ──────────────────────────────────────────────────────────

@api_pipeline_bp.route("/llm-council/health", methods=["GET"])
@rate_limit(10, 60, scope="llm-council-health")
def llm_council_health():
    """Validate LLM council provider configuration and optional live connectivity."""
    live_raw = str(request.args.get("live", "")).strip().lower()
    live = live_raw in {"1", "true", "yes", "on"}
    try:
        payload = validate_council_connectivity(live=live)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("LLM council health check failed: %s", exc, exc_info=True)
        return _error("LLM council health check failed", 503)
    return jsonify(payload)


@api_pipeline_bp.route("/llm-council/run", methods=["POST"])
@rate_limit(5, 60, scope="llm-council-run")
def llm_council_run():
    """Run the multi-model IMMI council and return ranked/synthesized output."""
    data = request.get_json(silent=True) or {}
    question = str(data.get("question", "")).strip()
    if not question:
        return _error("question is required")
    if len(question) > MAX_LLM_COUNCIL_QUESTION_LEN:
        return _error(
            f"question is too long (max {MAX_LLM_COUNCIL_QUESTION_LEN} characters)"
        )

    case_context = str(data.get("context", "")).strip()
    if len(case_context) > MAX_LLM_COUNCIL_CONTEXT_LEN:
        case_context = case_context[:MAX_LLM_COUNCIL_CONTEXT_LEN]

    case_id = str(data.get("case_id", "")).strip()
    if case_id:
        if not _valid_case_id(case_id):
            return _error("Invalid case ID")
        case = get_repo().get_by_id(case_id)
        if not case:
            return _error("Case not found", 404)
        case_context = _build_llm_case_context(case, case_context)

    precedents = _find_llm_precedents(
        question,
        case_id=case_id,
        case_facts=case_context,
    )
    precedent_context = _build_llm_precedent_context(precedents)
    if precedent_context:
        merged_context = (
            f"{case_context}\n\n{precedent_context}" if case_context else precedent_context
        )
        case_context = merged_context[:MAX_LLM_COUNCIL_CONTEXT_LEN]

    try:
        payload = run_immi_council(question=question, case_context=case_context)
    except ValueError as exc:
        return _error(str(exc))
    except Exception as exc:  # pragma: no cover - network/provider failures
        logger.warning("LLM council run failed: %s", exc, exc_info=True)
        return _error("LLM council backend unavailable", 503)

    payload["retrieved_cases"] = [
        {
            "case_id": c.case_id,
            "citation": c.citation,
            "title": c.title,
            "court": c.court_code or c.court,
            "date": c.date,
            "outcome": c.outcome,
            "legal_concepts": c.legal_concepts,
            "url": c.url,
        }
        for c in precedents
    ]

    return jsonify(payload)
