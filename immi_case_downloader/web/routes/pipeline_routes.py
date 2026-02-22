"""Pipeline routes.

/pipeline UI route redirects to React SPA. JSON API routes are preserved.
"""

from flask import redirect, request, jsonify

from ..security import csrf


def init_routes(app):
    @app.route("/pipeline", methods=["GET", "POST"])
    def pipeline_page():
        return redirect("/app/pipeline", 301)

    @app.route("/api/pipeline-status")
    def pipeline_status_api():
        from ...pipeline import get_pipeline_status
        return jsonify(get_pipeline_status())

    @app.route("/api/pipeline-log")
    def pipeline_log_api():
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
        from ...pipeline import request_pipeline_stop

        data = request.get_json(silent=True) or {}
        action = data.get("action", "")

        if action == "stop":
            request_pipeline_stop()
            return jsonify({"ok": True, "message": "Stop requested."})

        return jsonify({"ok": False, "message": f"Unknown action: {action}"}), 400
