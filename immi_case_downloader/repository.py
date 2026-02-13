"""CaseRepository Protocol — defines the interface for case persistence backends."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from .models import ImmigrationCase


@runtime_checkable
class CaseRepository(Protocol):
    """Abstract interface for case data storage.

    Implementations: SqliteRepository, CsvRepository.
    """

    def load_all(self) -> list[ImmigrationCase]:
        """Load all cases."""
        ...

    def get_by_id(self, case_id: str) -> ImmigrationCase | None:
        """Find a single case by its case_id."""
        ...

    def save_many(self, cases: list[ImmigrationCase]) -> int:
        """Upsert multiple cases. Returns count of inserted/updated rows."""
        ...

    def update(self, case_id: str, updates: dict) -> bool:
        """Update fields of an existing case. Returns True on success."""
        ...

    def delete(self, case_id: str) -> bool:
        """Delete a case by ID. Returns True if deleted."""
        ...

    def add(self, case: ImmigrationCase) -> ImmigrationCase:
        """Insert a single new case. Returns the case with ID assigned."""
        ...

    def get_statistics(self) -> dict:
        """Compute dashboard statistics."""
        ...

    def get_existing_urls(self) -> set[str]:
        """Return all known case URLs for deduplication."""
        ...

    def filter_cases(
        self,
        court: str = "",
        year: int | None = None,
        visa_type: str = "",
        source: str = "",
        tag: str = "",
        nature: str = "",
        keyword: str = "",
        sort_by: str = "year",
        sort_dir: str = "desc",
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[ImmigrationCase], int]:
        """Filter, sort, and paginate cases. Returns (page_cases, total_count)."""
        ...

    def search_text(self, query: str, limit: int = 50) -> list[ImmigrationCase]:
        """Full-text search across key fields. Returns matching cases."""
        ...

    def find_related(self, case_id: str, limit: int = 5) -> list[ImmigrationCase]:
        """Find cases related by nature, visa_type, and court_code."""
        ...

    def export_csv_rows(self) -> list[dict]:
        """Return all cases as list of dicts for CSV export."""
        ...

    def export_json(self) -> dict:
        """Return JSON-serializable export data."""
        ...

    def get_filter_options(self) -> dict:
        """Return unique values for filter dropdowns."""
        ...

    def get_case_full_text(self, case: ImmigrationCase) -> str | None:
        """Read the full text file for a case."""
        ...
