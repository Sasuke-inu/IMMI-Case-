"""Tests for Phase 0: CRITICAL security fixes.

Covers:
- Issue 0.1: CSRF protection (CWE-352)
- Issue 0.2: Secret key hardcoding (CWE-798)
- Issue 0.3: Default host binding (CWE-668)
- Issue 0.4: Security HTTP headers (CWE-693)
"""

import os
from unittest.mock import patch

import pytest


# ── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def csrf_app(populated_dir):
    """Flask test app with CSRF protection ENABLED (for security tests)."""
    from immi_case_downloader.webapp import create_app

    application = create_app(str(populated_dir))
    application.config["TESTING"] = True
    # Keep CSRF enabled — this fixture is specifically for CSRF tests
    return application


@pytest.fixture
def csrf_client(csrf_app):
    """Test client with CSRF enabled."""
    return csrf_app.test_client()



# ── Issue 0.1: CSRF Protection ─────────────────────────────────────────────


class TestCSRFProtection:
    """Verify CSRF is configured for the application.

    Legacy form routes have been replaced by 301 redirects to the React SPA.
    CSRF protection now applies to the JSON API layer (used by the React SPA).
    """

    def test_api_pipeline_action_csrf_exempt(self, csrf_client):
        """JSON API endpoint is CSRF-exempt (uses custom header pattern)."""
        resp = csrf_client.post(
            "/api/pipeline-action",
            json={"action": "stop"},
            content_type="application/json",
        )
        # Should not return 400 for missing CSRF — API is exempt
        assert resp.status_code != 400 or b"CSRF" not in resp.data

    def test_legacy_routes_redirect_not_form(self, csrf_client):
        """Legacy POST form routes 301/302 redirect instead of processing forms."""
        for path in ["/cases/add", "/search", "/download", "/pipeline", "/update-db"]:
            resp = csrf_client.get(path)
            assert resp.status_code in (301, 302), (
                f"{path} should redirect (not render a form), got {resp.status_code}"
            )

    def test_csrf_token_endpoint_accessible(self, csrf_client):
        """React SPA CSRF token endpoint returns a token."""
        resp = csrf_client.get("/api/v1/csrf-token")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "csrf_token" in data


# ── Issue 0.2: Secret Key ──────────────────────────────────────────────────


class TestSecretKey:
    """Verify secret key is not hardcoded and uses env var or random."""

    def test_secret_key_from_env(self, populated_dir):
        """When SECRET_KEY env var is set, it should be used."""
        test_key = "test-secret-key-from-env-var-12345"
        with patch.dict(os.environ, {"SECRET_KEY": test_key}):
            from immi_case_downloader.web import create_app
            app = create_app(str(populated_dir))
            assert app.secret_key == test_key

    def test_secret_key_no_hardcoded_fallback(self):
        """The string 'immi-case-dev-key' must NOT appear in web/__init__.py."""
        import immi_case_downloader.web as web_mod
        source_path = web_mod.__file__
        with open(source_path) as f:
            source = f.read()
        assert "immi-case-dev-key" not in source, (
            "Hardcoded development key still present in source code"
        )

    def test_secret_key_random_when_missing(self, populated_dir):
        """Without SECRET_KEY env var, a random key should be generated."""
        env = os.environ.copy()
        env.pop("SECRET_KEY", None)
        with patch.dict(os.environ, env, clear=True):
            from immi_case_downloader.web import create_app
            app = create_app(str(populated_dir))
            # Should not be the old hardcoded value
            assert app.secret_key != "immi-case-dev-key-change-in-prod"
            # Should be a non-empty string
            assert len(app.secret_key) >= 32


# ── Issue 0.3: Default Host Binding ────────────────────────────────────────


class TestDefaultHost:
    """Verify web.py defaults to localhost, not 0.0.0.0."""

    def test_default_host_is_localhost(self):
        """web.py argparse default should be 127.0.0.1, not 0.0.0.0."""
        import ast
        with open("web.py") as f:
            source = f.read()
        tree = ast.parse(source)
        # Find the add_argument call for --host
        for node in ast.walk(tree):
            if (isinstance(node, ast.Call) and
                    hasattr(node, 'args') and
                    any(isinstance(a, ast.Constant) and a.value == "--host"
                        for a in node.args)):
                # Check the default= keyword
                for kw in node.keywords:
                    if kw.arg == "default":
                        assert isinstance(kw.value, ast.Constant)
                        assert kw.value.value == "127.0.0.1", (
                            f"Default host is '{kw.value.value}', should be '127.0.0.1'"
                        )
                        return
        pytest.fail("Could not find --host argument definition in web.py")

    def test_debug_with_public_host_warns(self):
        """Using debug mode with 0.0.0.0 should produce a warning."""
        import subprocess
        result = subprocess.run(
            ["python3", "-c", """
import warnings
import sys
sys.argv = ['web.py', '--host', '0.0.0.0', '--debug', '--port', '0']
# Patch Flask.run to not actually start the server
from unittest.mock import patch
with patch("flask.Flask.run"):
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        from web import main
        main()
        for w in caught:
            if 'public' in str(w.message).lower() or '0.0.0.0' in str(w.message):
                print('WARNING_FOUND')
                break
        else:
            print('NO_WARNING')
"""],
            capture_output=True, text=True, timeout=10
        )
        assert "WARNING_FOUND" in result.stdout, (
            f"No warning about public host in debug mode. stdout={result.stdout}, stderr={result.stderr}"
        )


# ── Issue 0.4: Security HTTP Headers ───────────────────────────────────────


class TestSecurityHeaders:
    """Verify security headers are set on all responses."""

    EXPECTED_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "strict-origin-when-cross-origin",
    }

    def test_security_headers_present(self, client):
        """All responses should include security headers."""
        resp = client.get("/")
        for header, value in self.EXPECTED_HEADERS.items():
            assert resp.headers.get(header) == value, (
                f"Missing or wrong header {header}: "
                f"expected '{value}', got '{resp.headers.get(header)}'"
            )

    def test_csp_header_value(self, client):
        """Content-Security-Policy should be set with reasonable defaults."""
        resp = client.get("/")
        csp = resp.headers.get("Content-Security-Policy")
        assert csp is not None, "Content-Security-Policy header missing"
        # Should at least restrict default-src
        assert "default-src" in csp

    def test_security_headers_on_all_pages(self, client):
        """Security headers should appear on various page types."""
        for path in ["/", "/cases", "/search", "/export/json"]:
            resp = client.get(path)
            assert resp.headers.get("X-Content-Type-Options") == "nosniff", (
                f"X-Content-Type-Options missing from {path}"
            )

    def test_security_headers_on_error_pages(self, client):
        """Security headers should appear even on 404 pages."""
        resp = client.get("/nonexistent-page-12345")
        assert resp.headers.get("X-Content-Type-Options") == "nosniff"
