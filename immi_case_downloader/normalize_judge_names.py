"""Judge name normalization and deduplication utilities."""

import re
from typing import Dict, List, Optional
from fuzzywuzzy import fuzz


def normalize_judge_name(name: Optional[str]) -> str:
    """
    Normalize judge name for duplicate detection.

    Removes titles, extracts surname, converts to lowercase,
    removes special characters and diacritics.

    Examples:
        >>> normalize_judge_name("Justice Smith")
        'smith'
        >>> normalize_judge_name("O'Brien")
        'obrien'
        >>> normalize_judge_name("Müller")
        'muller'

    Args:
        name: The judge name to normalize.

    Returns:
        Normalized surname in lowercase.
    """
    if not name or not isinstance(name, str):
        return ""

    # Remove titles
    titles = r"(Justice|Hon\.|Judge|Mr\.|Ms\.|ACJ|FCA)\s*"
    cleaned = re.sub(titles, "", name, flags=re.IGNORECASE).strip()

    # Handle empty result
    if not cleaned:
        return ""

    # Normalize whitespace and extract surname (last word)
    words = re.sub(r"\s+", " ", cleaned).split()
    surname = words[-1] if words else ""

    # Convert to lowercase
    surname = surname.lower()

    # Remove accents (common European diacritics)
    accents = {
        "àáâãäå": "a",
        "èéêë": "e",
        "ìíîï": "i",
        "òóôõö": "o",
        "ùúûü": "u",
        "ýÿ": "y",
        "ñ": "n",
        "ç": "c",
    }
    for chars, replacement in accents.items():
        for char in chars:
            surname = surname.replace(char, replacement)

    # Remove all non-alphanumeric characters
    surname = re.sub(r"[^a-z0-9]", "", surname)

    return surname


def find_duplicate_judges(
    names: List[str], threshold: float = 0.85
) -> List[List[str]]:
    """
    Find groups of similar judge names using fuzzy matching.

    Groups names that are similar enough to be the same person
    based on normalized surname comparison.

    Args:
        names: List of judge names.
        threshold: Similarity threshold (0-1) for grouping.

    Returns:
        List of groups, where each group contains similar names.
    """
    if not names:
        return []

    groups: List[List[str]] = []
    processed = set()

    for name in names:
        if name in processed:
            continue

        group = [name]
        normalized_current = normalize_judge_name(name)

        for other_name in names:
            if other_name in processed or other_name == name:
                continue

            # Use fuzzy ratio for similarity comparison
            similarity = fuzz.ratio(
                normalized_current, normalize_judge_name(other_name)
            )

            # Convert to 0-1 scale
            if similarity / 100.0 >= threshold:
                group.append(other_name)

        groups.append(group)
        processed.update(group)

    return groups


def merge_judge_records(
    judge_groups: Dict[str, List[Dict]],
) -> Dict[str, Dict]:
    """
    Merge duplicate judge records into single entries.

    Combines statistics from duplicate records and selects
    the most complete name as canonical.

    Args:
        judge_groups: Dict mapping canonical name to list of records.

    Returns:
        Dict with merged records containing aggregated statistics.
    """
    merged = {}

    for canonical_name, records in judge_groups.items():
        # Aggregate case counts and wins
        total_cases = sum(r.get("case_count", 0) for r in records)
        total_wins = sum(r.get("wins", 0) for r in records)

        # Select name with highest case count as canonical
        canonical = max(
            records, key=lambda r: r.get("case_count", 0)
        ).get("name", canonical_name)

        # Calculate success rate
        success_rate = total_wins / total_cases if total_cases > 0 else 0

        merged[canonical_name] = {
            "canonical_name": canonical,
            "case_count": total_cases,
            "wins": total_wins,
            "success_rate": success_rate,
            "variants": [r.get("name") for r in records],
        }

    return merged
