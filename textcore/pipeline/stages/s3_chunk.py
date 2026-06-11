"""S3 deterministic semantic chunking."""

from __future__ import annotations

import re
from collections import Counter
from typing import Any

MIN_CHARS = 2400
TARGET_CHARS = 3600
MAX_CHARS = 4200
HARD_MAX_CHARS = 5200

PRESERVE_TYPES = {
    "文言文原文": "classical_text",
    "古诗词": "poetry",
}
COURSE_TYPE_BY_SEGMENT = {
    "文言文原文": "classical_chinese",
    "古诗词": "poetry",
    "作文点评": "essay_feedback",
    "题目": "test_strategy",
    "学生回答": "modern_reading",
    "课堂管理": "mixed",
    "闲聊": "mixed",
    "讲解": "modern_reading",
}


def chunk(
    paragraphs: list[dict[str, Any]],
    segments: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Merge S2 segment annotations into stable S3 paragraph-range chunks."""

    if not paragraphs:
        return []

    paragraph_by_pid = {paragraph["pid"]: paragraph for paragraph in paragraphs}
    units = _build_units(paragraphs, segments)
    chunks: list[dict[str, Any]] = []
    current: list[dict[str, Any]] = []
    current_chars = 0
    previous_text = ""

    for unit in units:
        if current and _should_flush(current, current_chars, unit):
            chunk_item, previous_text = _make_chunk(
                len(chunks) + 1,
                current,
                paragraph_by_pid,
                previous_text,
            )
            chunks.append(chunk_item)
            current = []
            current_chars = 0

        current.append(unit)
        current_chars += unit["char_count"]

    if current:
        chunk_item, _ = _make_chunk(len(chunks) + 1, current, paragraph_by_pid, previous_text)
        chunks.append(chunk_item)

    return chunks


def infer_course_types(segments: list[dict[str, Any]]) -> dict[str, Any]:
    counts = Counter(
        COURSE_TYPE_BY_SEGMENT.get(segment["segment_type"], "mixed") for segment in segments
    )
    counts.pop("mixed", None)
    if not counts:
        counts["mixed"] = 1

    total = sum(counts.values())
    ranked = counts.most_common()
    return {
        "types": [
            {"type": course_type, "confidence": round(count / total, 2)}
            for course_type, count in ranked[:4]
        ],
        "dominant_type": ranked[0][0],
        "mixed": len(ranked) > 1,
    }


def _build_units(
    paragraphs: list[dict[str, Any]],
    segments: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    segment_by_pid = {segment["pid"]: segment for segment in segments}
    units: list[dict[str, Any]] = []

    for paragraph in paragraphs:
        segment = segment_by_pid[paragraph["pid"]]
        preserve_reason = _preserve_reason(paragraph["text"], segment["segment_type"])
        unit = {
            "pids": [paragraph["pid"]],
            "segment_type": segment["segment_type"],
            "is_boundary": segment["is_boundary"],
            "char_count": len(paragraph["text"]),
            "preserve_spans": _preserve_spans(paragraph["text"], preserve_reason),
        }
        if (
            units
            and preserve_reason
            and units[-1]["preserve_spans"]
            and units[-1]["segment_type"] == segment["segment_type"]
        ):
            units[-1]["pids"].append(paragraph["pid"])
            units[-1]["char_count"] += unit["char_count"]
            units[-1]["preserve_spans"].extend(unit["preserve_spans"])
        else:
            units.append(unit)

    return units


def _preserve_reason(text: str, segment_type: str) -> str | None:
    if segment_type in PRESERVE_TYPES:
        return PRESERVE_TYPES[segment_type]
    if segment_type == "作文点评" and re.search(r"(原句|原文|习作|作文).{0,24}[「“\"《]", text):
        return "essay_original_sentence"
    return None


def _preserve_spans(text: str, reason: str | None) -> list[dict[str, str]]:
    if not reason:
        return []
    return [{"text": text, "reason": reason}]


def _should_flush(
    current: list[dict[str, Any]],
    current_chars: int,
    next_unit: dict[str, Any],
) -> bool:
    if current_chars >= HARD_MAX_CHARS:
        return True
    type_changed = current[-1]["segment_type"] != next_unit["segment_type"]
    semantic_break = bool(next_unit["is_boundary"] or type_changed)
    if current_chars >= MIN_CHARS and semantic_break:
        return True
    if current_chars + next_unit["char_count"] > MAX_CHARS and current_chars >= MIN_CHARS:
        return True
    return current_chars >= TARGET_CHARS and semantic_break


def _make_chunk(
    number: int,
    units: list[dict[str, Any]],
    paragraph_by_pid: dict[str, dict[str, Any]],
    previous_text: str,
) -> tuple[dict[str, Any], str]:
    pids = [pid for unit in units for pid in unit["pids"]]
    type_counts = Counter(
        COURSE_TYPE_BY_SEGMENT.get(unit["segment_type"], "mixed")
        for unit in units
        for _ in unit["pids"]
    )
    primary_type = type_counts.most_common(1)[0][0]
    text = "\n".join(paragraph_by_pid[pid]["text"] for pid in pids)
    chunk_item = {
        "chunk_id": f"c{number:03d}",
        "paragraph_range": [pids[0], pids[-1]],
        "primary_type": primary_type,
        "context_before": previous_text[-300:],
        "must_preserve_spans": [
            span for unit in units for span in unit["preserve_spans"]
        ],
    }
    return chunk_item, text
