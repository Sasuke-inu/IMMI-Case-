"""Case CRUD routes + data dictionary."""

import re

from flask import render_template, request, redirect, url_for, flash

from ...config import AUSTLII_DATABASES
from ...models import ImmigrationCase
from ..helpers import get_repo, safe_int, ITEMS_PER_PAGE, EDITABLE_FIELDS

_HEX_ID = re.compile(r"^[0-9a-f]{12}$")
MAX_BATCH_SIZE = 200
MAX_TAG_LENGTH = 50

COMPARE_FIELDS = [
    ("citation", "Citation"),
    ("title", "Title"),
    ("court", "Court / Tribunal"),
    ("court_code", "Court Code"),
    ("date", "Decision Date"),
    ("year", "Year"),
    ("judges", "Judge(s) / Member(s)"),
    ("case_nature", "Case Nature"),
    ("outcome", "Outcome"),
    ("visa_type", "Visa Type"),
    ("legislation", "Legislation"),
    ("catchwords", "Catchwords"),
    ("legal_concepts", "Legal Concepts"),
    ("source", "Source"),
]


def _valid_case_id(case_id: str) -> bool:
    return bool(_HEX_ID.match(case_id))


def init_routes(app):
    @app.route("/cases")
    def case_list():
        """Browse, filter, and sort cases."""
        repo = get_repo()

        # Extract filter parameters
        court = request.args.get("court", "")
        year_str = request.args.get("year", "")
        year = None
        if year_str:
            try:
                year = int(year_str)
            except ValueError:
                pass
        visa_type = request.args.get("visa_type", "")
        keyword = request.args.get("q", "")
        source = request.args.get("source", "")
        tag = request.args.get("tag", "")
        nature = request.args.get("nature", "")
        sort_by = request.args.get("sort", "date")
        sort_dir = request.args.get("dir", "desc")
        page = safe_int(request.args.get("page"), default=1, min_val=1)

        # SQL-level filtering, sorting, and pagination
        page_cases, total = repo.filter_cases(
            court=court, year=year, visa_type=visa_type,
            source=source, tag=tag, nature=nature, keyword=keyword,
            sort_by=sort_by, sort_dir=sort_dir,
            page=page, page_size=ITEMS_PER_PAGE,
        )

        total_pages = max(1, (total + ITEMS_PER_PAGE - 1) // ITEMS_PER_PAGE)
        page = min(page, total_pages)

        # Efficient filter option retrieval
        opts = repo.get_filter_options()

        return render_template(
            "cases.html",
            cases=page_cases,
            total=total,
            page=page,
            total_pages=total_pages,
            courts=opts["courts"],
            years=opts["years"],
            sources=opts["sources"],
            natures=opts["natures"],
            all_tags=opts["tags"],
            filters={
                "court": court,
                "year": year_str,
                "visa_type": visa_type,
                "q": keyword,
                "source": source,
                "tag": tag,
                "nature": nature,
                "sort": sort_by,
                "dir": sort_dir,
            },
            databases=AUSTLII_DATABASES,
        )

    @app.route("/cases/<case_id>")
    def case_detail(case_id):
        """View a single case with full details."""
        if not _valid_case_id(case_id):
            flash("Invalid case ID.", "error")
            return redirect(url_for("case_list"))
        repo = get_repo()
        case = repo.get_by_id(case_id)
        if not case:
            flash("Case not found.", "error")
            return redirect(url_for("case_list"))

        full_text = repo.get_case_full_text(case)
        related = repo.find_related(case_id, limit=5)
        return render_template("case_detail.html", case=case, full_text=full_text, related_cases=related)

    @app.route("/cases/<case_id>/edit", methods=["GET", "POST"])
    def case_edit(case_id):
        """Edit a case's metadata and notes."""
        if not _valid_case_id(case_id):
            flash("Invalid case ID.", "error")
            return redirect(url_for("case_list"))
        repo = get_repo()
        case = repo.get_by_id(case_id)
        if not case:
            flash("Case not found.", "error")
            return redirect(url_for("case_list"))

        if request.method == "POST":
            updates = {}
            for field in EDITABLE_FIELDS:
                val = request.form.get(field, "")
                if field == "year":
                    try:
                        val = int(val) if val else 0
                    except ValueError:
                        val = case.year
                updates[field] = val

            if repo.update(case_id, updates):
                flash("Case updated successfully.", "success")
            else:
                flash("Failed to update case.", "error")
            return redirect(url_for("case_detail", case_id=case_id))

        return render_template("case_edit.html", case=case, editable_fields=EDITABLE_FIELDS, databases=AUSTLII_DATABASES)

    @app.route("/cases/<case_id>/delete", methods=["POST"])
    def case_delete(case_id):
        """Delete a case."""
        if not _valid_case_id(case_id):
            flash("Invalid case ID.", "error")
            return redirect(url_for("case_list"))
        repo = get_repo()
        if repo.delete(case_id):
            flash("Case deleted.", "success")
        else:
            flash("Failed to delete case.", "error")
        return redirect(url_for("case_list"))

    @app.route("/cases/add", methods=["GET", "POST"])
    def case_add():
        """Manually add a new case."""
        repo = get_repo()
        if request.method == "POST":
            data = {}
            for field in EDITABLE_FIELDS:
                data[field] = request.form.get(field, "")
            case = ImmigrationCase.from_dict(data)
            case = repo.add(case)
            flash(f"Case added: {case.citation or case.title}", "success")
            return redirect(url_for("case_detail", case_id=case.case_id))

        return render_template("case_add.html", editable_fields=EDITABLE_FIELDS, databases=AUSTLII_DATABASES)

    @app.route("/cases/batch", methods=["POST"])
    def case_batch():
        """Handle batch operations: add_tag, delete."""
        repo = get_repo()
        action = request.form.get("action", "")
        ids_str = request.form.get("ids", "")
        ids = [i.strip() for i in ids_str.split(",") if i.strip() and _valid_case_id(i.strip())]

        if not ids:
            flash("No cases selected.", "warning")
            return redirect(url_for("case_list"))

        if len(ids) > MAX_BATCH_SIZE:
            flash(f"Batch operations limited to {MAX_BATCH_SIZE} cases.", "warning")
            return redirect(url_for("case_list"))

        if action == "add_tag":
            tag = request.form.get("tag", "").strip().replace(",", "").replace("<", "").replace(">", "")
            if not tag:
                flash("No tag provided.", "warning")
                return redirect(url_for("case_list"))
            if len(tag) > MAX_TAG_LENGTH:
                flash(f"Tag must be {MAX_TAG_LENGTH} characters or less.", "warning")
                return redirect(url_for("case_list"))
            count = 0
            for cid in ids:
                case = repo.get_by_id(cid)
                if case:
                    existing_tags = {t.strip() for t in case.tags.split(",") if t.strip()} if case.tags else set()
                    if tag not in existing_tags:
                        existing_tags.add(tag)
                        repo.update(cid, {"tags": ", ".join(sorted(existing_tags))})
                        count += 1
            flash(f"Tag '{tag}' added to {count} case(s).", "success")

        elif action == "delete":
            count = 0
            for cid in ids:
                if repo.delete(cid):
                    count += 1
            flash(f"Deleted {count} case(s).", "success")

        else:
            flash("Unknown batch action.", "error")

        return redirect(url_for("case_list"))

    @app.route("/cases/compare")
    def case_compare():
        """Side-by-side comparison of 2-3 cases."""
        repo = get_repo()
        ids_str = request.args.get("ids", "")
        # Deduplicate while preserving order, validate format
        ids = list(dict.fromkeys(
            i.strip() for i in ids_str.split(",")
            if i.strip() and _valid_case_id(i.strip())
        ))
        if len(ids) < 2:
            flash("Select at least 2 cases to compare.", "warning")
            return redirect(url_for("case_list"))
        ids = ids[:3]  # Max 3 cases

        cases = []
        for cid in ids:
            case = repo.get_by_id(cid)
            if case:
                cases.append(case)

        if len(cases) < 2:
            flash("Could not find enough cases to compare.", "error")
            return redirect(url_for("case_list"))

        return render_template(
            "case_compare.html",
            cases=cases,
            compare_fields=COMPARE_FIELDS,
        )

    @app.route("/data-dictionary")
    def data_dictionary():
        """Show what data points are captured in the spreadsheet."""
        return render_template("data_dictionary.html")
