"""Update Database routes."""

import os
import threading

from flask import render_template, request, redirect, url_for, flash

from ...config import AUSTLII_DATABASES, START_YEAR, END_YEAR
from ..helpers import get_output_dir, get_repo, safe_int, safe_float
from ..jobs import (
    _job_lock, _job_status,
    _run_update_job, _run_bulk_download_job,
)


def init_routes(app):
    @app.route("/update-db", methods=["GET", "POST"])
    def update_db_page():
        """One-stop page to crawl new cases and download full texts."""
        repo = get_repo()
        cases = repo.load_all()

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
            with _job_lock:
                if _job_status["running"]:
                    flash("A job is already running. Please wait.", "warning")
                    return redirect(url_for("job_status_page"))

            action = request.form.get("action", "")
            out = get_output_dir()

            if action == "quick_update":
                thread = threading.Thread(
                    target=_run_update_job,
                    args=("quick",),
                    kwargs={
                        "delay": safe_float(request.form.get("delay"), default=0.5, min_val=0.3, max_val=5.0),
                        "output_dir": out,
                        "repo": get_repo(),
                    },
                    daemon=True,
                )
                thread.start()
                flash("Quick update started — fetching latest cases.", "success")
                return redirect(url_for("job_status_page"))

            elif action == "custom_crawl":
                databases = request.form.getlist("databases")
                start_year = safe_int(request.form.get("start_year"), default=END_YEAR, min_val=2000, max_val=2030)
                end_year_val = safe_int(request.form.get("end_year"), default=END_YEAR, min_val=2000, max_val=2030)
                delay = safe_float(request.form.get("delay"), default=0.5, min_val=0.3, max_val=5.0)

                thread = threading.Thread(
                    target=_run_update_job,
                    args=("custom",),
                    kwargs={
                        "databases": databases,
                        "start_year": start_year,
                        "end_year": end_year_val,
                        "delay": delay,
                        "output_dir": out,
                        "repo": get_repo(),
                    },
                    daemon=True,
                )
                thread.start()
                flash(
                    f"Custom crawl started: {', '.join(databases)} ({start_year}-{end_year_val}).",
                    "success",
                )
                return redirect(url_for("job_status_page"))

            elif action == "bulk_download":
                court_filter = request.form.get("court", "")
                limit = safe_int(request.form.get("limit"), default=1000, min_val=1, max_val=50000)
                delay = safe_float(request.form.get("delay"), default=0.5, min_val=0.3, max_val=5.0)

                thread = threading.Thread(
                    target=_run_bulk_download_job,
                    args=(court_filter, limit, delay, out),
                    kwargs={"repo": get_repo()},
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
