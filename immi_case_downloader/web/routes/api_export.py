"""Export endpoints — /api/v1/export/csv and /api/v1/export/json.

Extracted from api.py as cq-001 Phase A.
Security: MAX_EXPORT_ROWS reduced from 50 000 → 5 000 (sec-008 step-2).
Audit: every export logs IP, filters, and row count (sec-008 step-3).
"""

import io
import csv
import json
import logging
from datetime import datetime

from flask import Blueprint, request, send_file

from ...storage import CASE_FIELDS
from ..helpers import get_repo, _filter_cases
from ..security import rate_limit

logger = logging.getLogger(__name__)

api_export_bp = Blueprint("api_export", __name__, url_prefix="/api/v1")

# Hard cap on export size — reduces risk of data exfiltration and memory spikes.
# Raised from 50 000 to 5 000 as part of sec-008.
MAX_EXPORT_ROWS = 5_000


@api_export_bp.route("/export/csv")
@rate_limit(5, 3600, scope="export-csv")
def export_csv():
    repo = get_repo()
    cases = _filter_cases(repo.load_all(), request.args)[:MAX_EXPORT_ROWS]
    logger.info(
        "audit export_csv ip=%s filters=%s rows=%d",
        request.remote_addr,
        dict(request.args),
        len(cases),
    )
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


@api_export_bp.route("/export/json")
@rate_limit(5, 3600, scope="export-json")
def export_json():
    repo = get_repo()
    cases = _filter_cases(repo.load_all(), request.args)[:MAX_EXPORT_ROWS]
    logger.info(
        "audit export_json ip=%s filters=%s rows=%d",
        request.remote_addr,
        dict(request.args),
        len(cases),
    )
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
