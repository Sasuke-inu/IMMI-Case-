"""Data models for immigration cases."""

from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class ImmigrationCase:
    """Represents a single immigration court/tribunal case."""

    case_id: str = ""
    citation: str = ""
    title: str = ""
    court: str = ""
    court_code: str = ""
    date: str = ""
    year: int = 0
    url: str = ""
    judges: str = ""
    catchwords: str = ""
    outcome: str = ""
    visa_type: str = ""
    legislation: str = ""
    text_snippet: str = ""
    full_text_path: str = ""
    source: str = ""

    def to_dict(self) -> dict:
        return asdict(self)
