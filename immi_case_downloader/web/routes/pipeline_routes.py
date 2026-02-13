"""Smart Pipeline routes."""

import os

from flask import render_template, request, redirect, url_for, flash, jsonify

from ...config import AUSTLII_DATABASES, START_YEAR, END_YEAR
from ..helpers import get_output_dir, get_repo
from ..security import csrf
from ..jobs import _job_lock, _job_status


def init_routes(app):
    @app.route("/pipeline", methods=["GET", "POST"])
    def pipeline_page():
        """Smart Pipeline: configure, launch, and monitor."""
        from ...pipeline import PipelineConfig, start_pipeline, get_pipeline_status

        if request.method == "POST":
            ps = get_pipeline_status()
            if ps["running"]:
                flash("Pipeline is already running.", "warning")
                return redirect(url_for("pipeline_page"))
            with _job_lock:
                if _job_status["running"]:
                    flash("Another job is running. Please wait.", "warning")
                    return redirect(url_for("pipeline_page"))

            config = PipelineConfig.from_form(request.form)
            out = get_output_dir()
            if start_pipeline(config, out):
                flash("Smart Pipeline started!", "success")
            else:
                flash("Failed to start pipeline.", "error")
            return redirect(url_for("pipeline_page"))

        repo = get_repo()
        cases = repo.load_all()
        without_text = sum(
            1 for c in cases if not c.full_text_path or not os.path.exists(c.full_text_path)
        )
        from ...pipeline import get_pipeline_status
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
        from ...pipeline import get_pipeline_status
        return jsonify(get_pipeline_status())

    @app.route("/api/pipeline-log")
    def pipeline_log_api():
        """JSON API for structured debug logs with optional filtering."""
        from ...pipeline import get_pipeline_status
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
    @csrf.exempt
    def pipeline_action_api():
        """Handle user actions: stop pipeline. CSRF-exempt JSON API."""
        from ...pipeline import request_pipeline_stop

        data = request.get_json(silent=True) or {}
        action = data.get("action", "")

        if action == "stop":
            request_pipeline_stop()
            return jsonify({"ok": True, "message": "Stop requested."})

        return jsonify({"ok": False, "message": f"Unknown action: {action}"}), 400
