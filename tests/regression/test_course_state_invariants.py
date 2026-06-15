from __future__ import annotations

import copy
import io
import json
from pathlib import Path
from typing import Any

from docx import Document

from textcore.contracts.course_state import VERSION_KEYS, validate
from textcore.exporters.docx_export import export_course_docx
from textcore.pipeline.stages.s9_quality import run as run_s9

ROOT = Path(__file__).resolve().parents[2]
REAL_FIXTURE = ROOT / "data" / "processed" / "course_2026_652f24cc" / "course_state.json"
EXAMPLE_FIXTURE = ROOT / "schemas" / "course_state.example.json"
COMPRESSION_RANGES = {
    "faithful": (0.70, 0.95),
    "concise": (0.22, 0.45),
    "study": (0.05, 0.15),
    "outline": (0.03, 0.10),
}


def test_fixture_course_state_regression_invariants() -> None:
    state = _load_fixture()
    review_flags, quality = run_s9(
        chunk_results=state.get("chunk_results", []),
        classics_refs=state.get("classics_refs", []),
        global_result=state.get("global", {}),
        versions=state.get("versions", {}),
    )
    checked_state = copy.deepcopy(state)
    checked_state["review_flags"] = review_flags
    checked_state["quality"] = quality

    validate(checked_state)
    _assert_version_invariants(checked_state)
    assert checked_state["knowledge_cards"]
    assert checked_state["writing_materials"]
    assert checked_state["classics_refs"]
    for ref in checked_state["classics_refs"]:
        if ref.get("matched"):
            assert ref.get("canonical_text")
    assert checked_state["review_flags"]
    assert all(flag.get("flag_id") for flag in checked_state["review_flags"])

    content = export_course_docx(
        checked_state,
        sections=["summary", "concise", "cards", "materials", "review"],
        export_format="printable",
    )
    doc = Document(io.BytesIO(content))
    text = "\n".join(paragraph.text for paragraph in doc.paragraphs)
    assert "课程摘要" in text
    assert "精简整理" in text
    assert "知识卡片" in text


def _assert_version_invariants(state: dict[str, Any]) -> None:
    versions = state.get("versions", {})
    for key in VERSION_KEYS:
        version = versions[key]
        assert version.get("body_md", "").strip()
        lower, upper = COMPRESSION_RANGES[key]
        assert lower <= version["compression"] <= upper


def _load_fixture() -> dict[str, Any]:
    fixture = REAL_FIXTURE if REAL_FIXTURE.exists() else EXAMPLE_FIXTURE
    return json.loads(fixture.read_text(encoding="utf-8"))
