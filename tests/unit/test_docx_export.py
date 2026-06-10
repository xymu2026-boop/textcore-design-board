from __future__ import annotations

import io

from docx import Document

from textcore.contracts.course_state import load_example
from textcore.exporters.docx_export import export_course_docx


def test_docx_export_reopens_and_contains_selected_sections() -> None:
    state = load_example()

    content = export_course_docx(
        state,
        sections=["summary", "concise", "cards", "materials", "review"],
        export_format="printable",
    )

    doc = Document(io.BytesIO(content))
    text = "\n".join(paragraph.text for paragraph in doc.paragraphs)
    assert "课程摘要" in text
    assert "精简整理" in text
    assert "知识卡片" in text
    assert "作文素材" in text
    assert "复核标记" in text
    assert "保真清洗" not in text


def test_docx_export_honors_version_and_classics_selection() -> None:
    state = load_example()

    content = export_course_docx(
        state,
        sections=["faithful", "outline", "classics"],
        export_format="archive",
    )

    doc = Document(io.BytesIO(content))
    text = "\n".join(paragraph.text for paragraph in doc.paragraphs)
    assert "保真清洗" in text
    assert "结构提纲" in text
    assert "古文原文与资料" in text
    assert "精简整理" not in text
    assert "课程摘要" not in text
