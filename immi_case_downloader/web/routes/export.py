"""Export routes (CSV and JSON)."""

import io
import csv
import json
from datetime import datetime

from flask import request, redirect, url_for, flash, send_file

from ...storage import CASE_FIELDS
from ..helpers import get_repo, _filter_cases


def init_routes(app):
    @app.route("/export/<fmt>")
    def export_data(fmt):
        """Export cases as CSV or JSON download. Accepts same filter params as /cases."""
        repo = get_repo()
        cases = _filter_cases(repo.load_all(), request.args)

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
