"""Search, download, and job status routes."""

import os
import threading

from flask import render_template, request, redirect, url_for, flash, jsonify

from ...config import AUSTLII_DATABASES, START_YEAR, END_YEAR
from ..helpers import get_output_dir, get_repo, safe_int
from ..jobs import _job_lock, _job_status, _run_search_job, _run_download_job


def init_routes(app):
    @app.route("/search", methods=["GET", "POST"])
    def search_page():
        """Search for new immigration cases from online sources."""
        if request.method == "POST":
            with _job_lock:
                if _job_status["running"]:
                    flash("A job is already running. Please wait.", "warning")
                    return redirect(url_for("job_status_page"))

            databases = request.form.getlist("databases") or ["AATA", "ARTA", "FCA"]
            start_year = safe_int(request.form.get("start_year"), default=START_YEAR, min_val=2000, max_val=2030)
            end_year = safe_int(request.form.get("end_year"), default=END_YEAR, min_val=2000, max_val=2030)
            max_results = safe_int(request.form.get("max_results"), default=500, min_val=1, max_val=50000)
            search_fedcourt = "fedcourt" in request.form.getlist("sources")

            thread = threading.Thread(
                target=_run_search_job,
                args=(databases, start_year, end_year, max_results, search_fedcourt),
                kwargs={"output_dir": get_output_dir(), "repo": get_repo()},
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
        repo = get_repo()
        cases = repo.load_all()
        without_text = [c for c in cases if not c.full_text_path or not os.path.exists(c.full_text_path)]

        if request.method == "POST":
            with _job_lock:
                if _job_status["running"]:
                    flash("A job is already running. Please wait.", "warning")
                    return redirect(url_for("job_status_page"))

            court_filter = request.form.get("court", "")
            limit = safe_int(request.form.get("limit"), default=50, min_val=1, max_val=10000)

            thread = threading.Thread(
                target=_run_download_job,
                args=(court_filter, limit),
                kwargs={"output_dir": get_output_dir(), "repo": get_repo()},
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

    @app.route("/job-status")
    def job_status_page():
        with _job_lock:
            snapshot = dict(_job_status)
        return render_template("job_status.html", job=snapshot)

    @app.route("/api/job-status")
    def job_status_api():
        with _job_lock:
            snapshot = dict(_job_status)
        return jsonify(snapshot)
