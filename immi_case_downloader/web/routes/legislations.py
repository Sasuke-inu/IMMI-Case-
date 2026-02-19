"""API endpoints for legislations (list, detail, search).

All endpoints are prefixed with /api/v1/.
Returns consistent JSON response format with error handling.
"""

import os
import json
import logging
from typing import Any

from flask import Blueprint, request, jsonify

logger = logging.getLogger(__name__)

legislations_bp = Blueprint("legislations", __name__, url_prefix="/api/v1/legislations")

# Cache for legislations data loaded at app startup
_legislations_cache: list[dict[str, Any]] | None = None


def _load_legislations() -> list[dict[str, Any]]:
    """Load legislations from JSON file. Uses cache if already loaded."""
    global _legislations_cache

    if _legislations_cache is not None:
        return _legislations_cache

    # Build path to legislations.json
    pkg_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    data_path = os.path.join(pkg_dir, "data", "legislations.json")

    if not os.path.exists(data_path):
        logger.error(f"Legislations data file not found: {data_path}")
        return []

    try:
        with open(data_path, encoding="utf-8") as f:
            data = json.load(f)
        _legislations_cache = data.get("legislations", [])
        logger.info(f"Loaded {len(_legislations_cache)} legislations from {data_path}")
        return _legislations_cache
    except (json.JSONDecodeError, IOError) as e:
        logger.error(f"Failed to load legislations: {e}")
        return []


def _error(msg: str, status: int = 400):
    """Return error response in consistent format."""
    return jsonify({"success": False, "error": msg}), status


# ── List all legislations with pagination ──────────────────────────────────


@legislations_bp.route("", methods=["GET"])
def list_legislations():
    """List all legislations with pagination.

    Query parameters:
    - page: Page number (default: 1, min: 1)
    - limit: Items per page (default: 10, min: 1, max: 100)

    Returns JSON with pagination metadata.
    """
    try:
        # Get and validate pagination params
        page = request.args.get("page", 1, type=int)
        limit = request.args.get("limit", 10, type=int)

        # Validate ranges
        if page < 1:
            return _error("page must be >= 1", 400)
        if limit < 1:
            return _error("limit must be >= 1", 400)
        if limit > 100:
            limit = 100  # Cap max limit to prevent abuse

        legislations = _load_legislations()

        if not legislations:
            return jsonify({
                "success": True,
                "data": [],
                "meta": {
                    "total": 0,
                    "page": page,
                    "limit": limit,
                    "pages": 0
                }
            })

        total = len(legislations)
        total_pages = (total + limit - 1) // limit  # Ceiling division

        # Validate page number
        if page > total_pages and total_pages > 0:
            return _error(f"page must be <= {total_pages}", 400)

        # Calculate slice indices
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_data = legislations[start_idx:end_idx]

        return jsonify({
            "success": True,
            "data": paginated_data,
            "meta": {
                "total": total,
                "page": page,
                "limit": limit,
                "pages": total_pages
            }
        })

    except Exception as e:
        logger.error(f"Error listing legislations: {e}")
        return _error("Failed to list legislations", 500)


# ── Get a specific legislation by ID ────────────────────────────────────────


@legislations_bp.route("/<legislation_id>", methods=["GET"])
def get_legislation(legislation_id: str):
    """Get a specific legislation by ID.

    Args:
        legislation_id: The legislation ID (e.g., 'migration-act-1958')

    Returns JSON with legislation details or 404 if not found.
    """
    try:
        if not legislation_id or not legislation_id.strip():
            return _error("legislation_id is required", 400)

        legislation_id = legislation_id.strip().lower()
        legislations = _load_legislations()

        # Find legislation by ID (case-insensitive)
        for leg in legislations:
            if leg.get("id", "").lower() == legislation_id:
                return jsonify({
                    "success": True,
                    "data": leg
                })

        return _error(f"Legislation with ID '{legislation_id}' not found", 404)

    except Exception as e:
        logger.error(f"Error fetching legislation {legislation_id}: {e}")
        return _error("Failed to fetch legislation", 500)


# ── Search legislations ────────────────────────────────────────────────────


@legislations_bp.route("/search", methods=["GET"])
def search_legislations():
    """Search legislations by query string.

    Searches across title, description, shortcode, and id fields.
    Minimum 2 characters required for search query.

    Query parameters:
    - q: Search query (required, min 2 chars)
    - limit: Max results to return (default: 20, max: 100)

    Returns JSON with matching legislations.
    """
    try:
        query = request.args.get("q", "").strip()
        limit = request.args.get("limit", 20, type=int)

        # Validate query
        if not query:
            return _error("q (query) parameter is required", 400)
        if len(query) < 2:
            return _error("Query must be at least 2 characters", 400)

        # Validate limit
        if limit < 1:
            return _error("limit must be >= 1", 400)
        if limit > 100:
            limit = 100

        legislations = _load_legislations()
        query_lower = query.lower()

        # Search across multiple fields
        results = []
        for leg in legislations:
            # Check if query matches any searchable field
            searchable = [
                leg.get("title", ""),
                leg.get("description", ""),
                leg.get("shortcode", ""),
                leg.get("id", ""),
            ]

            # Case-insensitive substring match
            if any(query_lower in field.lower() for field in searchable):
                results.append(leg)
                if len(results) >= limit:
                    break

        return jsonify({
            "success": True,
            "data": results,
            "meta": {
                "query": query,
                "total_results": len(results),
                "limit": limit
            }
        })

    except Exception as e:
        logger.error(f"Error searching legislations: {e}")
        return _error("Failed to search legislations", 500)


def init_routes(app):
    """Register legislations blueprint with Flask app."""
    app.register_blueprint(legislations_bp)
    logger.info("Legislations API blueprint registered")
