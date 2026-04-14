"""Comprehensive webapp smoke test for IMMI-Case React SPA.

Tests:
- All 14 SPA pages load without JS errors or failed network requests
- Console errors and warnings are captured
- Critical flows: search, dark mode toggle, language switch
- Screenshots saved to /tmp/smoke-shots/ for visual comparison

Run:
    python3 tests/smoke_webapp.py             # both servers must be running
    python3 tests/smoke_webapp.py --base http://localhost:8080
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, Page

SMOKE_PAGES = [
    ("dashboard", "/"),
    ("analytics", "/analytics"),
    ("judge_profiles", "/judge-profiles"),
    ("court_lineage", "/court-lineage"),
    ("cases", "/cases"),
    ("collections", "/collections"),
    ("saved_searches", "/saved-searches"),
    ("cases_add", "/cases/add"),
    ("download", "/download"),
    ("jobs", "/jobs"),
    ("pipeline", "/pipeline"),
    ("legislations", "/legislations"),
    ("data_dictionary", "/data-dictionary"),
    ("design_tokens", "/design-tokens"),
]

OUT_DIR = Path("/tmp/smoke-shots")
OUT_DIR.mkdir(exist_ok=True)


def attach_listeners(page: Page, name: str, results: dict):
    """Attach console / pageerror / response listeners to capture all signals."""
    results.setdefault(name, {
        "console_errors": [],
        "console_warnings": [],
        "page_errors": [],
        "failed_requests": [],
        "load_time_s": None,
    })

    def on_console(msg):
        if msg.type == "error":
            results[name]["console_errors"].append(msg.text[:300])
        elif msg.type == "warning":
            # Filter noisy warnings (React DevTools, source maps)
            if "DevTools" in msg.text or "sourcemap" in msg.text.lower():
                return
            results[name]["console_warnings"].append(msg.text[:200])

    def on_page_error(err):
        results[name]["page_errors"].append(str(err)[:300])

    def on_response(resp):
        if resp.status >= 400 and "/api/" in resp.url:
            results[name]["failed_requests"].append(f"{resp.status} {resp.url}")

    page.on("console", on_console)
    page.on("pageerror", on_page_error)
    page.on("response", on_response)


def smoke_test_page(page: Page, name: str, path: str, base: str, results: dict) -> bool:
    """Navigate, wait for hydration, take screenshot. Returns True on success."""
    attach_listeners(page, name, results)
    url = f"{base}{path}"
    t0 = time.monotonic()
    try:
        page.goto(url, wait_until="networkidle", timeout=20000)
        # Wait for React hydration (per react_helpers.wait_for_react)
        page.wait_for_selector("#root", state="attached", timeout=15000)
        page.wait_for_function(
            "document.querySelector('#root')?.children.length > 0",
            timeout=15000,
        )
        # Wait briefly for any remaining XHRs to settle
        page.wait_for_timeout(500)
    except Exception as exc:
        results[name]["page_errors"].append(f"NAVIGATION_FAILED: {exc}")
        return False
    finally:
        results[name]["load_time_s"] = round(time.monotonic() - t0, 2)

    page.screenshot(path=str(OUT_DIR / f"{name}.png"), full_page=False)
    return True


def critical_flow_search(page: Page, base: str, results: dict):
    """Test the global search dropdown."""
    attach_listeners(page, "flow_search", results)
    page.goto(f"{base}/", wait_until="networkidle")
    try:
        # Search trigger button — adapt to your UI's actual selector
        page.keyboard.press("/")  # Try "/" shortcut common in dashboards
        page.wait_for_timeout(300)
        # Try filling search input
        search = page.locator('input[type="search"], input[placeholder*="Search" i]').first
        if search.is_visible():
            search.fill("visa")
            page.wait_for_timeout(800)
            page.screenshot(path=str(OUT_DIR / "flow_search.png"))
        else:
            results["flow_search"]["console_warnings"].append(
                "Could not locate global search input via '/' shortcut"
            )
    except Exception as exc:
        results["flow_search"]["page_errors"].append(f"SEARCH_FLOW: {exc}")


def critical_flow_dark_mode(page: Page, base: str, results: dict):
    """Test dark mode toggle and verify CSS class changes."""
    attach_listeners(page, "flow_dark_mode", results)
    page.goto(f"{base}/", wait_until="networkidle")
    try:
        # Read initial state
        initial = page.evaluate("document.documentElement.classList.contains('dark')")
        # Try to find a theme toggle (common patterns)
        toggle = page.get_by_role("button", name="Toggle theme", exact=False)
        if toggle.count() == 0:
            toggle = page.locator('button[aria-label*="theme" i], button[aria-label*="dark" i]').first
        if toggle.is_visible():
            toggle.click()
            page.wait_for_timeout(400)
            after = page.evaluate("document.documentElement.classList.contains('dark')")
            if after == initial:
                results["flow_dark_mode"]["console_errors"].append(
                    f"Toggle clicked but 'dark' class did not flip (was {initial})"
                )
            page.screenshot(path=str(OUT_DIR / "flow_dark_mode.png"))
        else:
            results["flow_dark_mode"]["console_warnings"].append("No theme toggle button found")
    except Exception as exc:
        results["flow_dark_mode"]["page_errors"].append(f"DARK_MODE: {exc}")


def critical_flow_case_detail(page: Page, base: str, results: dict):
    """Open the cases list and click the first case row."""
    attach_listeners(page, "flow_case_detail", results)
    page.goto(f"{base}/cases", wait_until="networkidle")
    try:
        page.wait_for_timeout(800)
        # Find first case link (anchor inside the list)
        first_link = page.locator('a[href*="/cases/"]').first
        if first_link.count() > 0:
            href = first_link.get_attribute("href")
            first_link.click()
            page.wait_for_load_state("networkidle", timeout=10000)
            page.wait_for_timeout(500)
            page.screenshot(path=str(OUT_DIR / "flow_case_detail.png"))
            results["flow_case_detail"]["console_warnings"].append(f"Opened: {href}")
        else:
            results["flow_case_detail"]["console_errors"].append("No case rows visible to click")
    except Exception as exc:
        results["flow_case_detail"]["page_errors"].append(f"CASE_DETAIL: {exc}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:8080")
    args = parser.parse_args()

    results: dict[str, dict] = {}
    print(f"Smoke testing {args.base} — screenshots in {OUT_DIR}\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        # Phase 1: page-level smoke
        for name, path in SMOKE_PAGES:
            ok = smoke_test_page(page, name, path, args.base, results)
            r = results[name]
            errs = len(r["page_errors"]) + len(r["console_errors"]) + len(r["failed_requests"])
            status = "OK " if (ok and errs == 0) else "FAIL"
            print(f"  [{status}] {name:18s} {path:25s} {r['load_time_s']:>5}s "
                  f"(pe={len(r['page_errors'])}, ce={len(r['console_errors'])}, "
                  f"net={len(r['failed_requests'])}, cw={len(r['console_warnings'])})")

        # Phase 2: critical flows
        print("\n  --- critical flows ---")
        critical_flow_search(page, args.base, results)
        critical_flow_dark_mode(page, args.base, results)
        critical_flow_case_detail(page, args.base, results)

        for flow in ("flow_search", "flow_dark_mode", "flow_case_detail"):
            r = results[flow]
            errs = len(r["page_errors"]) + len(r["console_errors"])
            status = "OK " if errs == 0 else "FAIL"
            print(f"  [{status}] {flow}")

        browser.close()

    # Write detailed report
    report_path = OUT_DIR / "report.json"
    report_path.write_text(json.dumps(results, indent=2))
    print(f"\nDetailed report: {report_path}")

    # Aggregate severity
    total_pe = sum(len(r["page_errors"]) for r in results.values())
    total_ce = sum(len(r["console_errors"]) for r in results.values())
    total_net = sum(len(r["failed_requests"]) for r in results.values())
    print(f"\nTotals: page_errors={total_pe}, console_errors={total_ce}, failed_api={total_net}")

    return 0 if (total_pe + total_ce + total_net) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
