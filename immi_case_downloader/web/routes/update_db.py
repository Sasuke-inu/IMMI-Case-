"""Update Database route — redirects to React SPA pipeline page."""

from flask import redirect


def init_routes(app):
    @app.route("/update-db", methods=["GET", "POST"])
    def update_db_page():
        return redirect("/app/pipeline", 301)
