"""Legal concepts normalization to title case format."""

from typing import Optional


def normalize_concept(concept: Optional[str]) -> str:
    """
    Normalize a legal concept to title case (sentence case).

    Articles, prepositions, and conjunctions remain lowercase except at the start.

    Examples:
        >>> normalize_concept("refugee status")
        'Refugee Status'
        >>> normalize_concept("the rule of law")
        'The Rule of Law'
        >>> normalize_concept("natural justice in proceedings")
        'Natural Justice in Proceedings'

    Args:
        concept: The legal concept string to normalize.

    Returns:
        The normalized concept in title case format.
    """
    if not concept or not isinstance(concept, str):
        return ""

    # Clean up: strip whitespace and handle extra spaces
    cleaned = " ".join(concept.strip().split())
    if not cleaned:
        return ""

    # Words that should remain lowercase (except first word)
    lowercase_words = {
        "the",
        "a",
        "an",
        "and",
        "or",
        "but",
        "in",
        "of",
        "at",
        "by",
        "for",
        "from",
        "to",
        "with",
        "as",
        "is",
        "on",
    }

    words = cleaned.split()
    normalized = []

    for i, word in enumerate(words):
        # Handle hyphenated words: capitalize each part
        if "-" in word:
            parts = word.split("-")
            capitalized_parts = [part.capitalize() for part in parts]
            word = "-".join(capitalized_parts)
            normalized.append(word)
        # First word always capitalized
        elif i == 0:
            normalized.append(word.capitalize())
        # Check if word should be lowercase
        elif word.lower() in lowercase_words:
            normalized.append(word.lower())
        # Default: capitalize
        else:
            normalized.append(word.capitalize())

    return " ".join(normalized)


def normalize_concepts_in_list(concepts: list[str]) -> list[str]:
    """
    Normalize a list of legal concepts.

    Args:
        concepts: List of concept strings.

    Returns:
        List of normalized concepts.
    """
    return [normalize_concept(c) for c in concepts]


def normalize_concepts_in_dict(data: dict, concept_field: str = "legal_concepts") -> dict:
    """
    Normalize concepts in a dictionary (for batch processing).

    Args:
        data: Dictionary containing concept field.
        concept_field: Name of the field containing concepts.

    Returns:
        Dictionary with normalized concepts.
    """
    if concept_field in data and isinstance(data[concept_field], list):
        data[concept_field] = normalize_concepts_in_list(data[concept_field])
    return data
