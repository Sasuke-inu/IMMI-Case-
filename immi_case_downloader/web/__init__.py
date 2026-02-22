"""Flask web application factory.

Splits the monolithic webapp.py into modular components:
- helpers.py   — utility functions (safe_int, safe_float, _filter_cases, etc.)
- security.py  — CSRF setup and security headers
- jobs.py      — background job state and runner functions
- routes/      — route modules registered via init_routes(app)
"""

import os
import secrets
import warnings
import logging

from dotenv import load_dotenv
from flask import Flask

from ..config import OUTPUT_DIR
from ..storage import ensure_output_dirs

load_dotenv()
from .security import csrf, add_security_headers

logger = logging.getLogger(__name__)


def create_app(output_dir: str = OUTPUT_DIR, backend: str = "auto"):
    """Application factory — creates and configures a Flask instance.

    Args:
        output_dir: Directory for case data files.
        backend: Storage backend — "sqlite", "csv", "supabase", or "auto".
    """
    pkg_dir = os.path.dirname(os.path.dirname(__file__))
    app = Flask(
        __name__,
        static_folder=os.path.join(pkg_dir, "static"),
    )

    # Secret key: prefer env var, fall back to random per-process key with warning
    _secret = os.environ.get("SECRET_KEY")
    if not _secret:
        warnings.warn(
            "SECRET_KEY not set! Using random key (sessions won't persist across restarts).",
            RuntimeWarning,
            stacklevel=2,
        )
        _secret = secrets.token_hex(32)
    app.secret_key = _secret

    # CSRF protection
    csrf.init_app(app)

    # App config
    app.config["OUTPUT_DIR"] = output_dir
    ensure_output_dirs(output_dir)

    # Repository backend
    db_path = os.path.join(output_dir, "cases.db")
    if backend == "auto":
        backend = "sqlite" if os.path.exists(db_path) else "csv"

    if backend == "supabase":
        from ..supabase_repository import SupabaseRepository
        app.config["REPO"] = SupabaseRepository(output_dir=output_dir)
        app.config["BACKEND"] = "supabase"
    elif backend == "sqlite":
        from ..sqlite_repository import SqliteRepository
        app.config["REPO"] = SqliteRepository(db_path)
        app.config["BACKEND"] = "sqlite"
    else:
        from ..csv_repository import CsvRepository
        app.config["REPO"] = CsvRepository(output_dir)
        app.config["BACKEND"] = "csv"

    # Security headers on every response
    @app.after_request
    def security_headers(response):
        return add_security_headers(response)

    # Register all route modules (flat endpoint names — no Blueprint prefix)
    from .routes import dashboard, cases, search, export, pipeline_routes, update_db
    dashboard.init_routes(app)
    cases.init_routes(app)
    search.init_routes(app)
    export.init_routes(app)
    pipeline_routes.init_routes(app)
    update_db.init_routes(app)

    # Register JSON API blueprint for React SPA
    from .routes.api import api_bp
    app.register_blueprint(api_bp)

    # Register Legislations API blueprint
    from .routes.legislations import legislations_bp
    app.register_blueprint(legislations_bp)

    # SPA catch-all: serve React build for non-API, non-legacy routes
    react_dir = os.path.join(pkg_dir, "static", "react")

    @app.route("/app/", defaults={"path": ""})
    @app.route("/app/<path:path>")
    def serve_spa(path):
        """Serve the React SPA from static/react/."""
        from flask import send_from_directory
        if path and os.path.exists(os.path.join(react_dir, path)):
            return send_from_directory(react_dir, path)
        return send_from_directory(react_dir, "index.html")

    return app
