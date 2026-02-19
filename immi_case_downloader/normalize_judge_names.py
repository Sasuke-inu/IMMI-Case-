"""Judge name normalization and deduplication utilities."""

import re
from typing import Dict, List, Optional
from fuzzywuzzy import fuzz

# Titles to strip (case-insensitive)
_TITLE_PATTERN = re.compile(
    r"\b(Justice|Hon\.?|Judge|Mr\.?|Ms\.?|Mrs\.?|Dr\.?|ACJ|FCA|"
    r"Senior\s+Member|Deputy\s+President|Member|President)\b\.?\s*",
    re.IGNORECASE,
)


def normalize_judge_name(name: Optional[str]) -> str:
    """
    Normalize judge name for duplicate detection.

    Removes titles, extracts surname (ignoring trailing initials),
    converts to lowercase, removes special characters and diacritics.

    In Australian legal naming convention, "Smith J" means Judge Smith
    — the trailing single letter is a title initial, not a surname.

    Examples:
        >>> normalize_judge_name("Justice Smith")
        'smith'
        >>> normalize_judge_name("SMITH J")
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
    cleaned = _TITLE_PATTERN.sub("", name).strip()

    # Handle empty result
    if not cleaned:
        return ""

    # Normalize whitespace
    cleaned = re.sub(r"\s+", " ", cleaned)

    # Remove commas (e.g. "Smith, J." → "Smith J.")
    cleaned = cleaned.replace(",", " ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    # Split into words
    words = cleaned.split()
    if not words:
        return ""

    # Strip trailing single-letter initials (e.g. "Smith J" → "Smith")
    # In Australian legal naming, trailing single chars are title abbreviations
    while len(words) > 1 and len(words[-1].rstrip(".")) <= 1:
        words.pop()

    # Take the last remaining word as the surname
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

    # Remove all non-alphanumeric characters (hyphens, apostrophes, etc.)
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
        names: List of judge names (may contain duplicates).
        threshold: Similarity threshold (0-1) for grouping.

    Returns:
        List of groups, where each group contains similar names.
    """
    if not names:
        return []

    groups: List[List[str]] = []
    assigned = [False] * len(names)

    for i, name in enumerate(names):
        if assigned[i]:
            continue

        group = [name]
        assigned[i] = True
        normalized_i = normalize_judge_name(name)

        for j in range(i + 1, len(names)):
            if assigned[j]:
                continue

            normalized_j = normalize_judge_name(names[j])

            # Use fuzzy ratio for similarity comparison
            similarity = fuzz.ratio(normalized_i, normalized_j) / 100.0

            if similarity >= threshold:
                group.append(names[j])
                assigned[j] = True

        groups.append(group)

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
