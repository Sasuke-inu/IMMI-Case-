"""CSRF token endpoint + write-path protection tests.

Per .omc/plans/hyperdrive-full-migration.md §E2E Test Reinforcement Plan
Phase 1 §New Tests Required → test_react_csrf.py.

These tests pass against BOTH the legacy Flask CSRF (server-session via
flask-wtf) AND the new Worker stateless HMAC double-submit, because the
contract from the SPA's perspective is identical:

  GET  /api/v1/csrf-token  →  {"csrf_token": "<non-empty>"}
  Future POST /api/v1/cases (no token)  →  403 / 400 / 422
"""

import requests


def test_csrf_token_endpoint_returns_token(base_url):
    """GET /api/v1/csrf-token returns 200 with a non-empty csrf_token field."""
    session = requests.Session()
    resp = session.get(f"{base_url}/api/v1/csrf-token", timeout=5)
    assert resp.status_code == 200, f"expected 200, got {resp.status_code}"
    data = resp.json()
    assert "csrf_token" in data, f"missing csrf_token in {data}"
    assert isinstance(data["csrf_token"], str)
    assert len(data["csrf_token"]) >= 16, "csrf_token suspiciously short"


def test_csrf_token_present_on_repeat_call(base_url):
    """Repeated GETs in the same session always return a token (may be same or rotated)."""
    session = requests.Session()
    t1 = session.get(f"{base_url}/api/v1/csrf-token", timeout=5).json()["csrf_token"]
    t2 = session.get(f"{base_url}/api/v1/csrf-token", timeout=5).json()["csrf_token"]
    assert t1 and t2, "tokens must be non-empty"
    # Don't assert equality — Flask returns same token mid-session, Worker
    # mints a fresh one each call. Both are valid contracts for the SPA.


def test_post_cases_without_csrf_blocked(base_url):
    """POST /api/v1/cases without CSRF token must NOT succeed.

    Acceptable: 400/403/405/422. Critical invariant: NEVER 201/200.
    """
    resp = requests.post(
        f"{base_url}/api/v1/cases",
        json={"title": "should not be inserted"},
        timeout=5,
    )
    assert resp.status_code in (
        400, 403, 405, 422
    ), f"write without CSRF must fail; got {resp.status_code}"


def test_post_cache_invalidate_without_csrf_blocked(base_url):
    """POST /api/v1/cache/invalidate without CSRF must be blocked."""
    resp = requests.post(
        f"{base_url}/api/v1/cache/invalidate", json={}, timeout=5
    )
    assert resp.status_code in (
        400, 401, 403, 405, 422
    ), f"cache/invalidate without CSRF must fail; got {resp.status_code}"
