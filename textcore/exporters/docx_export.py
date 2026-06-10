"""Word export for printable TextCore course material."""

from __future__ import annotations

import io
import re
from collections.abc import Iterable
from typing import Any

from docx import Document
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

from textcore.contracts.course_state import DEFAULT_VERSION, VERSION_KEYS

DEFAULT_EXPORT_SECTIONS = ("summary", "concise", "cards", "materials", "review")
EXPORT_FORMATS = {"printable", "archive"}
VERSION_LABELS = {
    "faithful": "保真清洗",
    "concise": "精简整理",
    "study": "学习整理",
    "outline": "结构提纲",
}


def export_course_docx(
    course_state: dict[str, Any],
    *,
    sections: Iterable[str] | None = None,
    export_format: str = "printable",
    current_version: str | None = None,
) -> bytes:
    """Render a course_state to a real .docx file."""

    selected = normalize_sections(sections, current_version=current_version)
    doc = Document()
    _configure_document(doc, export_format)

    meta = course_state.get("source", {}).get("detected_meta", {})
    title = (
        meta.get("course_title")
        or course_state.get("source", {}).get("file")
        or "TextCore 导出"
    )
    doc.add_heading(str(title), level=0)
    _add_low_key_paragraph(
        doc,
        " / ".join(
            item
            for item in [
                course_state.get("source", {}).get("file"),
                meta.get("teacher"),
                "完整留档" if export_format == "archive" else "简洁可打印",
            ]
            if item
        ),
    )

    if "summary" in selected:
        _add_summary(doc, course_state)
    for version_key in VERSION_KEYS:
        if version_key in selected:
            _add_version(doc, version_key, course_state.get("versions", {}).get(version_key, {}))
    if "cards" in selected:
        _add_cards(doc, course_state.get("knowledge_cards", []))
    if "materials" in selected:
        _add_materials(doc, course_state.get("writing_materials", []))
    if "review" in selected:
        _add_review_flags(doc, course_state.get("review_flags", []))
    if "classics" in selected:
        _add_classics(doc, course_state.get("classics_refs", []))
    if export_format == "archive":
        _add_archive_notes(doc, course_state)

    buffer = io.BytesIO()
    doc.save(buffer)
    return buffer.getvalue()


def normalize_sections(
    sections: Iterable[str] | None,
    *,
    current_version: str | None = None,
) -> set[str]:
    raw_sections = list(sections or DEFAULT_EXPORT_SECTIONS)
    normalized: set[str] = set()
    selected_current = current_version if current_version in VERSION_KEYS else DEFAULT_VERSION
    aliases = {
        "course_summary": "summary",
        "knowledge_cards": "cards",
        "writing_materials": "materials",
        "review_flags": "review",
        "classics_refs": "classics",
    }
    for section in raw_sections:
        key = aliases.get(section, section)
        if key == "current_version":
            normalized.add(selected_current)
        elif key in {*VERSION_KEYS, "summary", "cards", "materials", "review", "classics"}:
            normalized.add(key)
    return normalized or set(DEFAULT_EXPORT_SECTIONS)


def _configure_document(doc: Document, export_format: str) -> None:
    section = doc.sections[0]
    section.top_margin = Inches(0.7)
    section.bottom_margin = Inches(0.7)
    section.left_margin = Inches(0.75)
    section.right_margin = Inches(0.75)

    normal = doc.styles["Normal"]
    normal.font.name = "Arial"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    normal.font.size = Pt(10.5 if export_format == "printable" else 10)

    _ensure_paragraph_style(doc, "TC Low Key", RGBColor(100, 100, 100), Pt(9.5))
    quote = _ensure_paragraph_style(doc, "TC Quote", RGBColor(90, 90, 90), Pt(9.5))
    quote.paragraph_format.left_indent = Inches(0.18)
    quote.paragraph_format.space_before = Pt(2)
    quote.paragraph_format.space_after = Pt(4)


def _add_summary(doc: Document, course_state: dict[str, Any]) -> None:
    doc.add_heading("课程摘要", level=1)
    summary = course_state.get("global", {}).get("course_summary") or "暂无课程摘要。"
    _add_paragraphs(doc, str(summary))


def _add_version(doc: Document, version_key: str, version: dict[str, Any]) -> None:
    doc.add_heading(VERSION_LABELS[version_key], level=1)
    compression = version.get("compression")
    if compression is not None:
        _add_low_key_paragraph(doc, f"压缩率：{compression:.0%}")
    _append_markdown(doc, str(version.get("body_md") or "暂无正文。"), base_level=2)


def _add_cards(doc: Document, cards: list[dict[str, Any]]) -> None:
    doc.add_heading("知识卡片", level=1)
    if not cards:
        _add_low_key_paragraph(doc, "暂无知识卡片。")
        return
    for card in cards:
        doc.add_heading(str(card.get("title") or card.get("card_id") or "知识卡片"), level=2)
        _add_paragraphs(doc, card.get("summary"))
        _add_bullets(doc, card.get("core_points", []))
        if card.get("example"):
            _add_quote(doc, f"课堂例子：{card['example']}")


def _add_materials(doc: Document, materials: list[dict[str, Any]]) -> None:
    doc.add_heading("作文素材", level=1)
    if not materials:
        _add_low_key_paragraph(doc, "暂无作文素材。")
        return
    for material in materials:
        heading = material.get("title") or material.get("material_id") or "作文素材"
        doc.add_heading(str(heading), level=2)
        if material.get("theme"):
            _add_low_key_paragraph(doc, "主题：" + "、".join(material["theme"]))
        _add_paragraphs(doc, material.get("usable_expression"))
        _add_paragraphs(doc, material.get("teacher_comment"))
        if material.get("usage_suggestion"):
            _add_quote(doc, f"用法：{material['usage_suggestion']}")


def _add_review_flags(doc: Document, flags: list[dict[str, Any]]) -> None:
    doc.add_heading("复核标记", level=1)
    if not flags:
        _add_low_key_paragraph(doc, "暂无待复核项。")
        return
    for flag in flags:
        severity = flag.get("severity", "medium")
        flag_id = flag.get("flag_id", "")
        paragraph = doc.add_paragraph(style="TC Low Key")
        paragraph.add_run(f"{flag_id} [{severity}] ").bold = True
        paragraph.add_run(str(flag.get("text") or ""))
        reason = flag.get("reason")
        if reason:
            paragraph.add_run(f" - {reason}")
        suggestion = flag.get("suggestion")
        if suggestion:
            paragraph.add_run(f"；建议：{suggestion}")


def _add_classics(doc: Document, refs: list[dict[str, Any]]) -> None:
    doc.add_heading("古文原文与资料", level=1)
    matched_refs = [ref for ref in refs if ref.get("matched")]
    if not matched_refs:
        _add_low_key_paragraph(doc, "暂无已匹配的古文资料。")
        return
    for ref in matched_refs:
        title = ref.get("title") or ref.get("ref_id") or "古文引用"
        writer = f" - {ref['writer']}" if ref.get("writer") else ""
        doc.add_heading(f"{title}{writer}", level=2)
        _add_classics_block(doc, "原文", ref.get("canonical_text"))
        _add_classics_block(doc, "译文", ref.get("translation"))
        _add_classics_block(doc, "注释", ref.get("remark"))
        _add_classics_block(doc, "赏析", ref.get("shangxi"))
        if ref.get("diffs"):
            _add_quote(doc, "存在课稿与权威文本差异，已纳入复核标记。")


def _add_archive_notes(doc: Document, course_state: dict[str, Any]) -> None:
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
    doc.add_heading("留档信息", level=1)
    quality = course_state.get("quality", {})
    _add_low_key_paragraph(
        doc,
        "；".join(
            item
            for item in [
                (
                    f"质量分：{quality.get('quality_score')}"
                    if quality.get("quality_score") is not None
                    else ""
                ),
                f"覆盖：{quality.get('coverage')}" if quality.get("coverage") else "",
                (
                    "建议人工复核：是"
                    if quality.get("recommended_human_review")
                    else "建议人工复核：否"
                ),
            ]
            if item
        ),
    )
    for risk in quality.get("main_risks", []):
        _add_quote(doc, str(risk))


def _add_classics_block(doc: Document, label: str, text: Any) -> None:
    if not text:
        return
    doc.add_heading(label, level=3)
    for paragraph in str(text).splitlines():
        if paragraph.strip():
            _add_quote(doc, paragraph.strip())


def _append_markdown(doc: Document, markdown: str, *, base_level: int) -> None:
    for raw_line in markdown.splitlines():
        line = raw_line.rstrip()
        if not line.strip():
            continue
        heading = re.match(r"^(#{1,6})\s+(.+)$", line)
        if heading:
            level = min(4, base_level + len(heading.group(1)) - 1)
            doc.add_heading(_plain_text(heading.group(2)), level=level)
            continue
        bullet = re.match(r"^\s*[-*]\s+(.+)$", line)
        if bullet:
            doc.add_paragraph(_plain_text(bullet.group(1)), style="List Bullet")
            continue
        numbered = re.match(r"^\s*\d+[.)]\s+(.+)$", line)
        if numbered:
            doc.add_paragraph(_plain_text(numbered.group(1)), style="List Number")
            continue
        quote = re.match(r"^\s*>\s+(.+)$", line)
        if quote:
            _add_quote(doc, _plain_text(quote.group(1)))
            continue
        _add_paragraphs(doc, _plain_text(line))


def _add_paragraphs(doc: Document, text: Any) -> None:
    if not text:
        return
    for paragraph in str(text).splitlines():
        if paragraph.strip():
            doc.add_paragraph(_plain_text(paragraph.strip()))


def _add_bullets(doc: Document, items: Iterable[Any]) -> None:
    for item in items:
        if item:
            doc.add_paragraph(_plain_text(str(item)), style="List Bullet")


def _add_quote(doc: Document, text: str) -> None:
    doc.add_paragraph(_plain_text(text), style="TC Quote")


def _add_low_key_paragraph(doc: Document, text: str) -> None:
    if text:
        doc.add_paragraph(_plain_text(text), style="TC Low Key")


def _plain_text(text: str) -> str:
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    return text.strip()


def _ensure_paragraph_style(
    doc: Document,
    name: str,
    color: RGBColor,
    size: Pt,
):
    try:
        style = doc.styles[name]
    except KeyError:
        style = doc.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
    style.font.color.rgb = color
    style.font.size = size
    style.font.name = "Arial"
    style._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    return style


def _set_cell_shading(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), fill)
    tc_pr.append(shading)
