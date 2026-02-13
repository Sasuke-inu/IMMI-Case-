"""Dashboard route."""

from flask import render_template

from ...config import AUSTLII_DATABASES
from ..helpers import get_repo


def init_routes(app):
    @app.route("/")
    def dashboard():
        """Dashboard with statistics and quick actions."""
        repo = get_repo()
        stats = repo.get_statistics()
        return render_template("dashboard.html", stats=stats, databases=AUSTLII_DATABASES)
