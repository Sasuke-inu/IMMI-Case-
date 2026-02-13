"""Tests for Phase 0: CRITICAL security fixes.

Covers:
- Issue 0.1: CSRF protection (CWE-352)
- Issue 0.2: Secret key hardcoding (CWE-798)
- Issue 0.3: Default host binding (CWE-668)
- Issue 0.4: Security HTTP headers (CWE-693)
"""

import os
import re
import secrets
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


def _get_csrf_token(client, path="/cases/add"):
    """Helper: fetch a page and extract the CSRF token from the form."""
    resp = client.get(path)
    html = resp.data.decode()
    match = re.search(r'name="csrf_token"[^>]*value="([^"]+)"', html)
    if not match:
        match = re.search(r'value="([^"]+)"[^>]*name="csrf_token"', html)
    return match.group(1) if match else None


# ── Issue 0.1: CSRF Protection ─────────────────────────────────────────────


class TestCSRFProtection:
    """Verify CSRF tokens are present and enforced on POST routes."""

    @pytest.mark.parametrize("path", [
        "/cases/add",
        "/search",
        "/download",
        "/pipeline",
        "/update-db",
    ])
    def test_csrf_token_present_in_forms(self, csrf_client, path):
        """All POST form pages must include a csrf_token hidden field."""
        # Reset pipeline status so /pipeline shows the config form (not the monitor)
        from immi_case_downloader.pipeline import _pipeline_lock, _pipeline_status
        with _pipeline_lock:
            _pipeline_status["phases_completed"] = []
            _pipeline_status["running"] = False

        resp = csrf_client.get(path)
        assert resp.status_code == 200
        html = resp.data.decode()
        assert 'name="csrf_token"' in html, (
            f"CSRF token hidden field missing from {path}"
        )

    def test_post_without_csrf_rejected(self, csrf_client):
        """POST without CSRF token should be rejected (400)."""
        resp = csrf_client.post("/cases/add", data={
            "citation": "[2024] TEST 999",
            "title": "Test case",
            "court_code": "AATA",
        })
        assert resp.status_code == 400, (
            f"POST without CSRF token should return 400, got {resp.status_code}"
        )

    def test_post_with_valid_csrf_accepted(self, csrf_client):
        """POST with a valid CSRF token should be processed normally."""
        token = _get_csrf_token(csrf_client, "/cases/add")
        assert token is not None, "Could not extract CSRF token from form"

        resp = csrf_client.post("/cases/add", data={
            "csrf_token": token,
            "citation": "[2024] TEST 888",
            "title": "CSRF test case",
            "court_code": "AATA",
            "year": "2024",
            "source": "AustLII",
        }, follow_redirects=True)
        # Should redirect to case detail (302 → 200) or return 200 directly
        assert resp.status_code == 200

    def test_api_endpoint_csrf_exempt(self, csrf_client):
        """JSON API endpoint should not require CSRF token."""
        resp = csrf_client.post(
            "/api/pipeline-action",
            json={"action": "status"},
            content_type="application/json",
        )
        # Should not return 400 for missing CSRF
        assert resp.status_code != 400 or b"CSRF" not in resp.data

    def test_delete_requires_csrf(self, csrf_client, sample_cases):
        """DELETE via POST requires CSRF token."""
        case_id = sample_cases[0].case_id
        resp = csrf_client.post(f"/cases/{case_id}/delete")
        assert resp.status_code == 400, (
            "DELETE without CSRF should be rejected"
        )


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
