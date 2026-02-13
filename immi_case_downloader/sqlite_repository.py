"""SQLite-backed CaseRepository with FTS5 full-text search."""

import os
import sqlite3
import threading
import logging

from .models import ImmigrationCase
from .storage import CASE_FIELDS

logger = logging.getLogger(__name__)

# Fields that can be updated via the web interface (CWE-915 prevention).
ALLOWED_UPDATE_FIELDS = frozenset({
    "citation", "title", "court", "court_code", "date", "year", "url",
    "judges", "catchwords", "outcome", "visa_type", "legislation",
    "text_snippet", "user_notes", "tags", "case_nature", "legal_concepts",
})

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS cases (
    case_id TEXT PRIMARY KEY,
    citation TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    court TEXT NOT NULL DEFAULT '',
    court_code TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL DEFAULT '',
    year INTEGER NOT NULL DEFAULT 0,
    url TEXT NOT NULL DEFAULT '' UNIQUE,
    judges TEXT NOT NULL DEFAULT '',
    catchwords TEXT NOT NULL DEFAULT '',
    outcome TEXT NOT NULL DEFAULT '',
    visa_type TEXT NOT NULL DEFAULT '',
    legislation TEXT NOT NULL DEFAULT '',
    text_snippet TEXT NOT NULL DEFAULT '',
    full_text_path TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    user_notes TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    case_nature TEXT NOT NULL DEFAULT '',
    legal_concepts TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_court_code ON cases(court_code);
CREATE INDEX IF NOT EXISTS idx_year ON cases(year);
CREATE INDEX IF NOT EXISTS idx_court_year ON cases(court_code, year);
CREATE INDEX IF NOT EXISTS idx_source ON cases(source);
"""

_FTS_SQL = """
CREATE VIRTUAL TABLE IF NOT EXISTS cases_fts USING fts5(
    citation, title, catchwords, judges, outcome,
    user_notes, case_nature, legal_concepts,
    content='cases', content_rowid='rowid'
);
"""

_TRIGGERS_SQL = """
-- Keep FTS index in sync with cases table
CREATE TRIGGER IF NOT EXISTS cases_ai AFTER INSERT ON cases BEGIN
    INSERT INTO cases_fts(rowid, citation, title, catchwords, judges, outcome, user_notes, case_nature, legal_concepts)
    VALUES (new.rowid, new.citation, new.title, new.catchwords, new.judges, new.outcome, new.user_notes, new.case_nature, new.legal_concepts);
END;

CREATE TRIGGER IF NOT EXISTS cases_ad AFTER DELETE ON cases BEGIN
    INSERT INTO cases_fts(cases_fts, rowid, citation, title, catchwords, judges, outcome, user_notes, case_nature, legal_concepts)
    VALUES ('delete', old.rowid, old.citation, old.title, old.catchwords, old.judges, old.outcome, old.user_notes, old.case_nature, old.legal_concepts);
END;

CREATE TRIGGER IF NOT EXISTS cases_au AFTER UPDATE ON cases BEGIN
    INSERT INTO cases_fts(cases_fts, rowid, citation, title, catchwords, judges, outcome, user_notes, case_nature, legal_concepts)
    VALUES ('delete', old.rowid, old.citation, old.title, old.catchwords, old.judges, old.outcome, old.user_notes, old.case_nature, old.legal_concepts);
    INSERT INTO cases_fts(rowid, citation, title, catchwords, judges, outcome, user_notes, case_nature, legal_concepts)
    VALUES (new.rowid, new.citation, new.title, new.catchwords, new.judges, new.outcome, new.user_notes, new.case_nature, new.legal_concepts);
END;
"""


class SqliteRepository:
    """SQLite-backed case repository with FTS5 full-text search.

    Uses thread-local connections (one connection per thread) with WAL mode
    for safe concurrent reads from background job threads.
    """

    def __init__(self, db_path: str):
        self.db_path = db_path
        self._local = threading.local()
        self.initialize()

    def _conn(self) -> sqlite3.Connection:
        """Get or create a thread-local connection."""
        conn = getattr(self._local, "conn", None)
        if conn is None:
            conn = sqlite3.connect(self.db_path, timeout=10)
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA busy_timeout=5000")
            conn.execute("PRAGMA foreign_keys=ON")
            conn.row_factory = sqlite3.Row
            self._local.conn = conn
        return conn

    def initialize(self):
        """Create tables, indexes, FTS, and triggers if they don't exist."""
        conn = self._conn()
        conn.executescript(_SCHEMA_SQL)
        conn.executescript(_FTS_SQL)
        conn.executescript(_TRIGGERS_SQL)
        conn.commit()

    # ── Core CRUD ────────────────────────────────────────────────────

    def load_all(self) -> list[ImmigrationCase]:
        conn = self._conn()
        rows = conn.execute("SELECT * FROM cases").fetchall()
        return [self._row_to_case(r) for r in rows]

    def get_by_id(self, case_id: str) -> ImmigrationCase | None:
        conn = self._conn()
        row = conn.execute("SELECT * FROM cases WHERE case_id = ?", (case_id,)).fetchone()
        return self._row_to_case(row) if row else None

    def save_many(self, cases: list[ImmigrationCase]) -> int:
        """Upsert multiple cases. Returns count of affected rows."""
        conn = self._conn()
        cols = CASE_FIELDS
        placeholders = ", ".join("?" for _ in cols)
        updates = ", ".join(f"{c}=excluded.{c}" for c in cols if c != "case_id")
        sql = (
            f"INSERT INTO cases ({', '.join(cols)}) VALUES ({placeholders}) "
            f"ON CONFLICT(case_id) DO UPDATE SET {updates}"
        )
        count = 0
        # Batch in chunks of 500 for memory efficiency
        batch = []
        for case in cases:
            case.ensure_id()
            d = case.to_dict()
            batch.append(tuple(d.get(c, "") for c in cols))
            if len(batch) >= 500:
                conn.executemany(sql, batch)
                count += len(batch)
                batch.clear()
        if batch:
            conn.executemany(sql, batch)
            count += len(batch)
        conn.commit()
        return count

    def update(self, case_id: str, updates: dict) -> bool:
        """Update fields of an existing case. Only ALLOWED_UPDATE_FIELDS accepted."""
        safe_updates = {k: v for k, v in updates.items() if k in ALLOWED_UPDATE_FIELDS}
        if not safe_updates:
            return False
        conn = self._conn()
        sets = ", ".join(f"{k} = ?" for k in safe_updates)
        vals = list(safe_updates.values()) + [case_id]
        cur = conn.execute(f"UPDATE cases SET {sets} WHERE case_id = ?", vals)
        conn.commit()
        return cur.rowcount > 0

    def delete(self, case_id: str) -> bool:
        conn = self._conn()
        cur = conn.execute("DELETE FROM cases WHERE case_id = ?", (case_id,))
        conn.commit()
        return cur.rowcount > 0

    def add(self, case: ImmigrationCase) -> ImmigrationCase:
        case.source = case.source or "Manual Entry"
        case.ensure_id()
        self.save_many([case])
        return case

    # ── Query helpers ────────────────────────────────────────────────

    def get_statistics(self) -> dict:
        conn = self._conn()
        total = conn.execute("SELECT COUNT(*) FROM cases").fetchone()[0]

        by_court = {}
        for row in conn.execute("SELECT court, COUNT(*) as cnt FROM cases GROUP BY court ORDER BY court"):
            by_court[row["court"] or "Unknown"] = row["cnt"]

        by_year = {}
        for row in conn.execute("SELECT year, COUNT(*) as cnt FROM cases WHERE year > 0 GROUP BY year ORDER BY year"):
            by_year[row["year"]] = row["cnt"]

        by_nature = {}
        for row in conn.execute(
            "SELECT case_nature, COUNT(*) as cnt FROM cases WHERE case_nature != '' "
            "GROUP BY case_nature ORDER BY cnt DESC"
        ):
            by_nature[row["case_nature"]] = row["cnt"]

        visa_types = sorted(
            r["visa_type"]
            for r in conn.execute("SELECT DISTINCT visa_type FROM cases WHERE visa_type != ''")
        )

        with_text = conn.execute(
            "SELECT COUNT(*) FROM cases WHERE full_text_path != ''"
        ).fetchone()[0]

        sources = sorted(
            r["source"]
            for r in conn.execute("SELECT DISTINCT source FROM cases WHERE source != ''")
        )

        return {
            "total": total,
            "by_court": dict(sorted(by_court.items())),
            "by_year": dict(sorted(by_year.items())),
            "by_nature": by_nature,
            "visa_types": visa_types,
            "with_full_text": with_text,
            "sources": sources,
        }

    def get_existing_urls(self) -> set[str]:
        conn = self._conn()
        return {
            r["url"]
            for r in conn.execute("SELECT url FROM cases WHERE url != ''")
        }

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
        """SQL-level filtering, sorting, and pagination."""
        conn = self._conn()
        where_parts = []
        params: list = []

        if court:
            where_parts.append("court_code = ?")
            params.append(court)
        if year is not None:
            where_parts.append("year = ?")
            params.append(year)
        if visa_type:
            where_parts.append("visa_type LIKE ?")
            params.append(f"%{visa_type}%")
        if source:
            where_parts.append("source = ?")
            params.append(source)
        if tag:
            where_parts.append("tags LIKE ?")
            params.append(f"%{tag}%")
        if nature:
            where_parts.append("case_nature = ?")
            params.append(nature)
        if keyword:
            kw_like = f"%{keyword}%"
            where_parts.append(
                "(title LIKE ? OR citation LIKE ? OR catchwords LIKE ? "
                "OR judges LIKE ? OR outcome LIKE ? OR user_notes LIKE ? "
                "OR case_nature LIKE ? OR legal_concepts LIKE ?)"
            )
            params.extend([kw_like] * 8)

        where_clause = " AND ".join(where_parts) if where_parts else "1=1"

        # Allowed sort columns (prevent SQL injection)
        allowed_sorts = {"year", "date", "title", "court", "citation"}
        if sort_by not in allowed_sorts:
            sort_by = "year"
        direction = "DESC" if sort_dir == "desc" else "ASC"

        # Count total matching
        count_sql = f"SELECT COUNT(*) FROM cases WHERE {where_clause}"
        total = conn.execute(count_sql, params).fetchone()[0]

        # Fetch page
        offset = (max(1, page) - 1) * page_size
        data_sql = (
            f"SELECT * FROM cases WHERE {where_clause} "
            f"ORDER BY {sort_by} {direction} "
            f"LIMIT ? OFFSET ?"
        )
        rows = conn.execute(data_sql, params + [page_size, offset]).fetchall()
        cases = [self._row_to_case(r) for r in rows]

        return cases, total

    def search_text(self, query: str, limit: int = 50) -> list[ImmigrationCase]:
        """FTS5 full-text search."""
        import sqlite3 as _sqlite3
        conn = self._conn()
        # Sanitize FTS query — escape special characters
        safe_query = query.replace('"', '""')
        limit = max(1, min(limit, 200))
        try:
            rows = conn.execute(
                "SELECT c.* FROM cases c "
                "JOIN cases_fts f ON c.rowid = f.rowid "
                f'WHERE cases_fts MATCH ? ORDER BY rank LIMIT ?',
                (f'"{safe_query}"', limit),
            ).fetchall()
        except _sqlite3.OperationalError:
            logger.warning("FTS5 query failed for: %r", query[:100])
            return []
        return [self._row_to_case(r) for r in rows]

    def find_related(self, case_id: str, limit: int = 5) -> list[ImmigrationCase]:
        """Find related cases by case_nature + visa_type + court_code."""
        limit = max(1, min(limit, 20))
        case = self.get_by_id(case_id)
        if not case:
            return []

        conn = self._conn()
        # Score: 3 points for same nature, 2 for same visa_type, 1 for same court
        conditions = []
        params: list = []
        if case.case_nature:
            conditions.append("(CASE WHEN case_nature = ? THEN 3 ELSE 0 END)")
            params.append(case.case_nature)
        if case.visa_type:
            conditions.append("(CASE WHEN visa_type = ? THEN 2 ELSE 0 END)")
            params.append(case.visa_type)
        if case.court_code:
            conditions.append("(CASE WHEN court_code = ? THEN 1 ELSE 0 END)")
            params.append(case.court_code)

        if not conditions:
            return []

        score_expr = " + ".join(conditions)
        # score_expr appears twice in SQL (SELECT + WHERE), so duplicate params
        score_params = list(params)
        all_params = score_params + [case_id] + score_params + [limit]

        rows = conn.execute(
            f"SELECT *, ({score_expr}) as relevance FROM cases "
            f"WHERE case_id != ? AND ({score_expr}) > 0 "
            f"ORDER BY relevance DESC, year DESC LIMIT ?",
            all_params,
        ).fetchall()
        return [self._row_to_case(r) for r in rows]

    def export_csv_rows(self) -> list[dict]:
        return [c.to_dict() for c in self.load_all()]

    def export_json(self) -> dict:
        cases = self.load_all()
        return {
            "total_cases": len(cases),
            "courts": sorted({c.court for c in cases if c.court}),
            "year_range": {
                "min": min((c.year for c in cases if c.year), default=0),
                "max": max((c.year for c in cases if c.year), default=0),
            },
            "cases": [c.to_dict() for c in cases],
        }

    def get_filter_options(self) -> dict:
        """Efficient SQL-based filter option retrieval."""
        conn = self._conn()
        courts = sorted(
            r["court_code"] for r in conn.execute(
                "SELECT DISTINCT court_code FROM cases WHERE court_code != ''"
            )
        )
        years = sorted(
            (r["year"] for r in conn.execute(
                "SELECT DISTINCT year FROM cases WHERE year > 0"
            )),
            reverse=True,
        )
        sources = sorted(
            r["source"] for r in conn.execute(
                "SELECT DISTINCT source FROM cases WHERE source != ''"
            )
        )
        natures = sorted(
            r["case_nature"] for r in conn.execute(
                "SELECT DISTINCT case_nature FROM cases WHERE case_nature != ''"
            )
        )
        tags_raw = conn.execute(
            "SELECT DISTINCT tags FROM cases WHERE tags != ''"
        ).fetchall()
        all_tags = set()
        for r in tags_raw:
            for t in r["tags"].split(","):
                t = t.strip()
                if t:
                    all_tags.add(t)

        return {
            "courts": courts,
            "years": years,
            "sources": sources,
            "natures": natures,
            "tags": sorted(all_tags),
        }

    def get_case_full_text(self, case: ImmigrationCase) -> str | None:
        """Read the full text file for a case."""
        from .storage import get_case_full_text
        base_dir = os.path.dirname(self.db_path)
        return get_case_full_text(case, base_dir=base_dir)

    # ── Internal helpers ─────────────────────────────────────────────

    @staticmethod
    def _row_to_case(row: sqlite3.Row) -> ImmigrationCase:
        """Convert a sqlite3.Row to ImmigrationCase, handling type coercion."""
        d = dict(row)
        # Remove any extra columns (like 'relevance' from find_related)
        valid_fields = {f.name for f in ImmigrationCase.__dataclass_fields__.values()}
        filtered = {k: v for k, v in d.items() if k in valid_fields}
        return ImmigrationCase.from_dict(filtered)
