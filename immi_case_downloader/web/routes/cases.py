"""Case routes — 301 redirects to React SPA equivalents."""

from flask import redirect


def init_routes(app):
    @app.route("/cases")
    def case_list():
        return redirect("/app/cases", 301)

    @app.route("/cases/add", methods=["GET", "POST"])
    def case_add():
        return redirect("/app/cases/add", 301)

    @app.route("/cases/compare")
    def case_compare():
        return redirect("/app/cases/compare", 301)

    @app.route("/cases/batch", methods=["POST"])
    def case_batch():
        return redirect("/app/cases", 302)

    @app.route("/cases/<case_id>")
    def case_detail(case_id):
        return redirect(f"/app/cases/{case_id}", 301)

    @app.route("/cases/<case_id>/edit", methods=["GET", "POST"])
    def case_edit(case_id):
        return redirect(f"/app/cases/{case_id}/edit", 301)

    @app.route("/cases/<case_id>/delete", methods=["POST"])
    def case_delete(case_id):
        return redirect("/app/cases", 302)

    @app.route("/data-dictionary")
    def data_dictionary():
        return redirect("/app/data-dictionary", 301)
