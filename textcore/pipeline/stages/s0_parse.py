"""S0 deterministic Word parsing."""

from __future__ import annotations

import re
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

SPEAKER_TS_RE = re.compile(
    r"^\s*(?P<speaker>[\u4e00-\u9fffA-Za-z][\u4e00-\u9fffA-Za-zA-Z·._-]{1,24})"
    r"\s+(?P<ts>\d{1,2}:\d{2}:\d{2})(?:\s*(?P<text>.*))?$"
)

_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def parse_docx(source_path: Path, source_filename: str | None = None) -> dict[str, Any]:
    """Parse a .docx into immutable S0 paragraphs plus filename/intro metadata."""

    raw_paragraphs = _read_docx_paragraphs(source_path)
    if not raw_paragraphs:
        fallback = Path(source_filename or source_path.name).stem
        raw_paragraphs = [{"text": fallback, "style": "Normal"}]

    paragraphs: list[dict[str, Any]] = []
    pending_speaker: str | None = None
    pending_ts: str | None = None
    content_order = 0

    for raw in raw_paragraphs:
        text = _clean_text(raw["text"])
        if not text:
            continue

        speaker = pending_speaker
        ts = pending_ts
        stripped_text = text
        match = SPEAKER_TS_RE.match(text)
        if match:
            speaker = match.group("speaker").strip()
            ts = _normalize_ts(match.group("ts"))
            rest = (match.group("text") or "").strip()
            if not rest:
                pending_speaker = speaker
                pending_ts = ts
                continue
            stripped_text = rest
            pending_speaker = speaker
            pending_ts = ts

        content_order += 1
        paragraph: dict[str, Any] = {
            "pid": f"p{content_order:04d}",
            "text": stripped_text,
            "style": raw.get("style") or "Normal",
            "source_order": content_order,
        }
        if speaker:
            paragraph["speaker"] = speaker
        if ts:
            paragraph["ts"] = ts
        paragraphs.append(paragraph)

    return {
        "paragraphs": paragraphs,
        "detected_meta": detect_meta(
            source_filename or source_path.name,
            paragraphs,
        ),
    }


def detect_meta(source_filename: str, paragraphs: list[dict[str, Any]]) -> dict[str, Any]:
    """Infer coarse source metadata from stable filename and opening text cues."""

    stem = Path(source_filename).stem
    opening = "\n".join(paragraph["text"] for paragraph in paragraphs[:8])
    meta: dict[str, Any] = {
        "course_title": stem,
        "content_type_candidates": _content_candidates(stem + "\n" + opening),
    }

    group_match = re.search(r"([一二三四五六七八九十\d]+[上下])", stem)
    if group_match:
        meta["student_group"] = group_match.group(1)

    date_match = re.search(r"(?:_|-)(\d{2})(\d{2})(?:\D|$)", opening + "\n" + stem)
    if date_match:
        meta["date"] = f"{date_match.group(1)}-{date_match.group(2)}"

    speakers = Counter(
        paragraph.get("speaker")
        for paragraph in paragraphs[:40]
        if paragraph.get("speaker")
    )
    if speakers:
        meta["teacher"] = speakers.most_common(1)[0][0]

    return meta


def _read_docx_paragraphs(source_path: Path) -> list[dict[str, str]]:
    try:
        return _read_with_python_docx(source_path)
    except Exception:
        return _read_with_ooxml(source_path)


def _read_with_python_docx(source_path: Path) -> list[dict[str, str]]:
    from docx import Document  # type: ignore[import-not-found]

    document = Document(source_path)
    return [
        {"text": paragraph.text, "style": paragraph.style.name if paragraph.style else "Normal"}
        for paragraph in document.paragraphs
    ]


def _read_with_ooxml(source_path: Path) -> list[dict[str, str]]:
    try:
        with zipfile.ZipFile(source_path) as archive:
            document_xml = archive.read("word/document.xml")
    except (FileNotFoundError, KeyError, zipfile.BadZipFile):
        return []

    root = ET.fromstring(document_xml)
    paragraphs: list[dict[str, str]] = []
    for paragraph in root.iter(f"{_W}p"):
        parts: list[str] = []
        for node in paragraph.iter():
            if node.tag == f"{_W}t" and node.text:
                parts.append(node.text)
            elif node.tag == f"{_W}tab":
                parts.append("\t")
            elif node.tag == f"{_W}br":
                parts.append("\n")
        text = "".join(parts).strip()
        if text:
            paragraphs.append({"text": text, "style": "Normal"})
    return paragraphs


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\u3000", " ")).strip()


def _normalize_ts(ts: str) -> str:
    hour, minute, second = ts.split(":")
    return f"{int(hour):02d}:{minute}:{second}"


def _content_candidates(text: str) -> list[str]:
    rules = [
        ("文言文", ("文言文", "古文", "传记", "袁宏道", "醉叟")),
        ("古诗词", ("古诗", "诗词", "诗歌", "闻笛", "意象")),
        ("现代文阅读", ("现代文", "阅读理解", "散文", "小说", "题型")),
        ("作文点评", ("作文点评", "点评作文", "习作点评")),
        ("作文方法", ("写作", "作文", "立意", "素材")),
        ("应试策略", ("考试", "答题", "题型", "应试")),
        ("人文故事", ("人文", "豪侠", "志怪", "传奇")),
    ]
    candidates: list[str] = []
    for label, keywords in rules:
        if any(keyword in text for keyword in keywords):
            candidates.append(label)
    return candidates or ["混合课"]
