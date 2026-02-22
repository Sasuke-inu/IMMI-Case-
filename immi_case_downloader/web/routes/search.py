"""Search/download/job-status routes.

UI routes 301-redirect to React SPA. /api/job-status JSON endpoint is preserved.
"""

from flask import redirect, jsonify

from ..jobs import _job_lock, _job_status


def init_routes(app):
    @app.route("/search", methods=["GET", "POST"])
    def search_page():
        return redirect("/app/download", 301)

    @app.route("/download", methods=["GET", "POST"])
    def download_page():
        return redirect("/app/download", 301)

    @app.route("/job-status")
    def job_status_page():
        return redirect("/app/jobs", 301)

    @app.route("/api/job-status")
    def job_status_api():
        with _job_lock:
            snapshot = dict(_job_status)
        return jsonify(snapshot)
