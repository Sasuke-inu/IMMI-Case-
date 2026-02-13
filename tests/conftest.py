"""Shared test fixtures for IMMI-Case tests."""

import pytest

from immi_case_downloader.models import ImmigrationCase
from immi_case_downloader.storage import save_cases_csv, save_cases_json, ensure_output_dirs


@pytest.fixture
def sample_case():
    """A fully populated ImmigrationCase."""
    case = ImmigrationCase(
        case_id="",
        citation="[2024] AATA 100",
        title="Smith v Minister for Immigration",
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
        full_text_path="",
        source="AustLII",
        user_notes="",
        tags="",
        case_nature="Visa Refusal",
        legal_concepts="Character Test; Section 501",
    )
    case.ensure_id()
    return case


@pytest.fixture
def sample_cases():
    """Multiple ImmigrationCase objects with unique URLs."""
    cases = []
    courts = [
        ("AATA", "Administrative Appeals Tribunal"),
        ("FCA", "Federal Court of Australia"),
        ("FCCA", "Federal Circuit Court of Australia"),
        ("FedCFamC2G", "Federal Circuit and Family Court (Div 2)"),
        ("HCA", "High Court of Australia"),
    ]
    for i, (code, name) in enumerate(courts):
        case = ImmigrationCase(
            citation=f"[2024] {code} {100 + i}",
            title=f"Applicant {i} v Minister for Immigration",
            court=name,
            court_code=code,
            date=f"2024-0{i+1}-15",
            year=2024,
            url=f"https://www.austlii.edu.au/au/cases/cth/{code}/2024/{100+i}.html",
            source="AustLII",
            case_nature="Visa Refusal",
            legal_concepts="Migration Act",
        )
        case.ensure_id()
        cases.append(case)
    return cases


@pytest.fixture
def populated_dir(tmp_path, sample_cases):
    """A tmp directory pre-populated with CSV and JSON data."""
    ensure_output_dirs(str(tmp_path))
    save_cases_csv(sample_cases, str(tmp_path))
    save_cases_json(sample_cases, str(tmp_path))
    return tmp_path


@pytest.fixture
def app(populated_dir):
    """Flask test app backed by populated_dir data (CSRF disabled for general tests)."""
    from immi_case_downloader.webapp import create_app

    application = create_app(str(populated_dir))
    application.config["TESTING"] = True
    application.config["WTF_CSRF_ENABLED"] = False
    return application


@pytest.fixture
def client(app):
    """Flask test client."""
    return app.test_client()
