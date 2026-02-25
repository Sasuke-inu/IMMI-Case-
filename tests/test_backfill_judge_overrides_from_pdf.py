"""Tests for PDF -> judge override backfill utility."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


def _load_script_module():
    script_path = Path(__file__).resolve().parents[1] / "scripts" / "backfill_judge_overrides_from_pdf.py"
    spec = importlib.util.spec_from_file_location("backfill_judge_overrides_from_pdf", script_path)
    module = importlib.util.module_from_spec(spec)
    assert spec is not None and spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_clean_line_does_not_destroy_words():
    module = _load_script_module()
    assert module._clean_line("The Honourable Justice Graham Eric Hiley RFD") == (
        "The Honourable Justice Graham Eric Hiley RFD"
    )
    assert module._clean_line("e Federal Circuit and Family Court of Australia") == (
        "Federal Circuit and Family Court of Australia"
    )


def test_extract_judiciary_names_filters_non_judicial_judging():
    module = _load_script_module()
    full_text = """
Mr Daniel Benjamin Besen, VIC
For significant service to visual arts.
• Judge, Gertrude Street Projection Festival, 2018.

His Honour Judge Michael Patrick Bourke, VIC
For significant service to the judiciary, to the law, and to the community of Melbourne.
Federal Circuit and Family Court of Australia
• Judge, since 2002.

Mr Lewis Rolf Driver, NSW
For significant service to the judiciary, and to the law.
Federal Circuit and Family Court of Australia (formerly Federal Magistrates Court of Australia)
• Judge, Division 2, 2000-2022.

The Honourable Justice Graham Eric Hiley RFD, NT
For significant service to the judiciary, to the law, and to the Indigenous community.
Northern Territory Supreme Court
• Acting Justice, since 2021.
"""
    names = module._extract_judiciary_names(full_text)

    assert "Michael Patrick Bourke" in names
    assert "Lewis Rolf Driver" in names
    assert "Graham Eric Hiley RFD" in names
    assert "Daniel Benjamin Besen" not in names


def test_merge_treats_postnominal_variant_as_equivalent():
    module = _load_script_module()
    payload = {"overrides": {"driver": "Lewis Rolf Driver AM"}}
    added, conflicts = module._merge_names_into_overrides(payload, ["Lewis Rolf Driver"])
    assert "driver" not in added
    assert conflicts == {}
    assert payload["overrides"]["driver"] == "Lewis Rolf Driver AM"
