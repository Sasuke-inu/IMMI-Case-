"""E2E test fixtures: dual-mode server (live vs fixture), seed data, Playwright helpers."""

import os
import socket
import threading
import time

import pytest

from immi_case_downloader.models import ImmigrationCase
from immi_case_downloader.storage import save_cases_csv, save_cases_json, ensure_output_dirs


# ---------------------------------------------------------------------------
# Seed data — 10 cases across 5 courts with deterministic, queryable values
# ---------------------------------------------------------------------------

SEED_CASES = [
    ImmigrationCase(
        citation="[2024] AATA 100",
        title="Singh v Minister for Immigration",
        court="Administrative Appeals Tribunal",
        court_code="AATA",
        date="2024-03-15",
        year=2024,
        url="https://www.austlii.edu.au/au/cases/cth/AATA/2024/100.html",
        judges="Senior Member Jones",
        catchwords="migration; visa refusal; character test",
        outcome="Affirmed",
        visa_type="Subclass 866 Protection Visa",
        legislation="Migration Act 1958 (Cth) s 501",
        text_snippet="The Tribunal affirms the decision under review.",
        source="AustLII",
        case_nature="Visa Refusal",
        legal_concepts="Character Test; Section 501",
    ),
    ImmigrationCase(
        citation="[2024] AATA 200",
        title="Chen v Minister for Immigration",
        court="Administrative Appeals Tribunal",
        court_code="AATA",
        date="2024-06-20",
        year=2024,
        url="https://www.austlii.edu.au/au/cases/cth/AATA/2024/200.html",
        judges="Deputy President Smith",
        catchwords="refugee; complementary protection; non-refoulement",
        outcome="Set aside",
        visa_type="Subclass 866 Protection Visa",
        legislation="Migration Act 1958 (Cth) s 36(2)(aa)",
        text_snippet="The decision is set aside and remitted.",
        source="AustLII",
        case_nature="Refugee Status",
        legal_concepts="Complementary Protection; Non-refoulement",
    ),
    ImmigrationCase(
        citation="[2023] FCA 500",
        title="Patel v Minister for Immigration",
        court="Federal Court of Australia",
        court_code="FCA",
        date="2023-09-10",
        year=2023,
        url="https://www.austlii.edu.au/au/cases/cth/FCA/2023/500.html",
        judges="Justice Williams",
        catchwords="judicial review; jurisdictional error; procedural fairness",
        outcome="Allowed",
        visa_type="Subclass 500 Student Visa",
        legislation="Migration Act 1958 (Cth) s 476",
        text_snippet="The application is allowed.",
        source="AustLII",
        case_nature="Judicial Review",
        legal_concepts="Jurisdictional Error; Procedural Fairness",
    ),
    ImmigrationCase(
        citation="[2023] FCA 600",
        title="Nguyen v Minister for Immigration",
        court="Federal Court of Australia",
        court_code="FCA",
        date="2023-11-05",
        year=2023,
        url="https://www.austlii.edu.au/au/cases/cth/FCA/2023/600.html",
        judges="Justice Brown",
        catchwords="appeal; merits review; no jurisdictional error",
        outcome="Dismissed",
        visa_type="Subclass 189 Skilled Independent",
        legislation="Migration Act 1958 (Cth) s 474",
        text_snippet="The application is dismissed.",
        source="AustLII",
        case_nature="Appeal",
        legal_concepts="Merits Review; Privative Clause",
    ),
    ImmigrationCase(
        citation="[2022] FCCA 300",
        title="Kumar v Minister for Immigration",
        court="Federal Circuit Court of Australia",
        court_code="FCCA",
        date="2022-05-22",
        year=2022,
        url="https://www.austlii.edu.au/au/cases/cth/FCCA/2022/300.html",
        judges="Judge Lee",
        catchwords="cancellation; character grounds; ministerial direction",
        outcome="Affirmed",
        visa_type="Subclass 801 Partner Visa",
        legislation="Migration Act 1958 (Cth) s 501(2)",
        text_snippet="The application is dismissed with costs.",
        source="AustLII",
        case_nature="Visa Cancellation",
        legal_concepts="Character Grounds; Ministerial Direction",
    ),
    ImmigrationCase(
        citation="[2022] FCCA 400",
        title="Ali v Minister for Immigration",
        court="Federal Circuit Court of Australia",
        court_code="FCCA",
        date="2022-08-14",
        year=2022,
        url="https://www.austlii.edu.au/au/cases/cth/FCCA/2022/400.html",
        judges="Judge Taylor",
        catchwords="bridging visa; detention; release conditions",
        outcome="Granted",
        visa_type="Subclass 050 Bridging Visa",
        legislation="Migration Act 1958 (Cth) s 72",
        text_snippet="The applicant is granted a bridging visa.",
        source="AustLII",
        case_nature="Detention Review",
        legal_concepts="Bridging Visa; Immigration Detention",
    ),
    ImmigrationCase(
        citation="[2024] FedCFamC2G 150",
        title="Wang v Minister for Immigration",
        court="Federal Circuit and Family Court (Div 2)",
        court_code="FedCFamC2G",
        date="2024-01-30",
        year=2024,
        url="https://www.austlii.edu.au/au/cases/cth/FedCFamC2G/2024/150.html",
        judges="Judge Adams",
        catchwords="student visa; GTE requirement; genuine temporary entrant",
        outcome="Dismissed",
        visa_type="Subclass 500 Student Visa",
        legislation="Migration Act 1958 (Cth) s 476A",
        text_snippet="The application for judicial review is dismissed.",
        source="AustLII",
        case_nature="Judicial Review",
        legal_concepts="GTE Requirement; Student Visa",
    ),
    ImmigrationCase(
        citation="[2024] FedCFamC2G 250",
        title="Martinez v Minister for Immigration",
        court="Federal Circuit and Family Court (Div 2)",
        court_code="FedCFamC2G",
        date="2024-04-18",
        year=2024,
        url="https://www.austlii.edu.au/au/cases/cth/FedCFamC2G/2024/250.html",
        judges="Judge Roberts",
        catchwords="partner visa; relationship genuine; assessment criteria",
        outcome="Remitted",
        visa_type="Subclass 820 Partner Visa",
        legislation="Migration Act 1958 (Cth) s 5F",
        text_snippet="The matter is remitted for reconsideration.",
        source="AustLII",
        case_nature="Visa Refusal",
        legal_concepts="Partner Visa; Genuine Relationship",
    ),
    ImmigrationCase(
        citation="[2023] HCA 10",
        title="Applicant X v Minister for Immigration",
        court="High Court of Australia",
        court_code="HCA",
        date="2023-07-01",
        year=2023,
        url="https://www.austlii.edu.au/au/cases/cth/HCA/2023/10.html",
        judges="Kiefel CJ, Gageler, Gordon, Steward, Gleeson JJ",
        catchwords="constitutional; aliens power; indefinite detention",
        outcome="Allowed",
        visa_type="",
        legislation="Constitution s 51(xix); Migration Act 1958 (Cth) s 189",
        text_snippet="Appeal allowed. Orders of the Federal Court set aside.",
        source="AustLII",
        case_nature="Constitutional",
        legal_concepts="Aliens Power; Indefinite Detention; Constitutional Law",
    ),
    ImmigrationCase(
        citation="[2024] HCA 5",
        title="Minister for Immigration v Respondent Y",
        court="High Court of Australia",
        court_code="HCA",
        date="2024-02-28",
        year=2024,
        url="https://www.austlii.edu.au/au/cases/cth/HCA/2024/5.html",
        judges="Gageler CJ, Gordon, Edelman, Steward, Gleeson JJ",
        catchwords="statutory construction; migration agent; registration",
        outcome="Dismissed",
        visa_type="",
        legislation="Migration Act 1958 (Cth) s 280",
        text_snippet="The appeal is dismissed.",
        source="AustLII",
        case_nature="Appeal",
        legal_concepts="Statutory Construction; Migration Agent; Registration",
    ),
]


def _prepare_seed_cases():
    """Return a copy of seed cases with IDs generated."""
    cases = []
    for c in SEED_CASES:
        case = ImmigrationCase(**c.__dict__)
        case.ensure_id()
        cases.append(case)
    return cases


def _find_free_port():
    """Find a free TCP port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


# ---------------------------------------------------------------------------
# Session-scoped fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def is_live_mode():
    """True if testing against an externally running server."""
    return bool(os.environ.get("E2E_BASE_URL"))


@pytest.fixture(scope="session")
def _fixture_server(tmp_path_factory, is_live_mode):
    """Auto-launch Flask server with seeded CSV data (fixture mode only)."""
    if is_live_mode:
        yield None
        return

    # Create temp dir with seed data
    tmp_dir = str(tmp_path_factory.mktemp("e2e_data"))
    ensure_output_dirs(tmp_dir)
    cases = _prepare_seed_cases()
    save_cases_csv(cases, tmp_dir)
    save_cases_json(cases, tmp_dir)

    # Create the Flask app with CSV backend
    from immi_case_downloader.web import create_app

    app = create_app(output_dir=tmp_dir, backend="csv")
    app.config["TESTING"] = True

    port = _find_free_port()
    server_url = f"http://127.0.0.1:{port}"

    # Run Flask in a daemon thread
    server_thread = threading.Thread(
        target=lambda: app.run(host="127.0.0.1", port=port, use_reloader=False),
        daemon=True,
    )
    server_thread.start()

    # Wait for server to be ready
    for _ in range(50):
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                break
        except OSError:
            time.sleep(0.1)
    else:
        raise RuntimeError(f"Flask fixture server did not start on port {port}")

    yield server_url


@pytest.fixture(scope="session")
def base_url(is_live_mode, _fixture_server):
    """Base URL for all E2E tests — live server or auto-launched fixture server."""
    if is_live_mode:
        return os.environ["E2E_BASE_URL"].rstrip("/")
    return _fixture_server


@pytest.fixture(scope="session")
def seed_cases():
    """The 10 seed cases with IDs — for assertions in fixture mode."""
    return _prepare_seed_cases()


# ---------------------------------------------------------------------------
# Per-test Playwright fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def page(browser, base_url):
    """Desktop browser page (1280x800) with JS error collection."""
    context = browser.new_context(
        viewport={"width": 1280, "height": 800},
        base_url=base_url,
        accept_downloads=True,
    )
    pg = context.new_page()
    pg._js_errors = []
    pg.on("pageerror", lambda err: pg._js_errors.append(str(err)))
    yield pg
    context.close()


@pytest.fixture
def mobile_page(browser, base_url):
    """Mobile browser page (390x844, iPhone-like) with JS error collection."""
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        base_url=base_url,
    )
    pg = context.new_page()
    pg._js_errors = []
    pg.on("pageerror", lambda err: pg._js_errors.append(str(err)))
    yield pg
    context.close()


@pytest.fixture
def skip_if_live(is_live_mode):
    """Skip destructive tests when running against live server."""
    if is_live_mode:
        pytest.skip("Skipped in live mode — destructive test")
