"""Dashboard route — redirects to React SPA."""

from flask import redirect


def init_routes(app):
    @app.route("/")
    def dashboard():
        return redirect("/app/", 301)
