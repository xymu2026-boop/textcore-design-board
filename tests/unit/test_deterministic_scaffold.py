from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from textcore.pipeline.deterministic.quality_gates import check_version_ratio
from textcore.pipeline.deterministic.transcript_cleaner import clean_transcript_text
from textcore.pipeline.deterministic.version_scaffold import (
    VERSION_KEYS,
    build_chunk_scaffolds,
    text_char_count,
)
from textcore.pipeline.stages.s0_parse import parse_docx
from textcore.pipeline.stages.s1_preclean import preclean
from textcore.pipeline.stages.s2_segment import segment
from textcore.pipeline.stages.s3_chunk import chunk, infer_course_types

ROOT = Path(__file__).resolve().parents[2]
SAMPLES = [
    ROOT / "素材" / "五上-人文综合涵养-寒假-第二讲-虚实-晚秋初冬.docx",
    ROOT / "素材" / "五上-人文综合涵养-寒假-第六讲-文言文阅读训练1.docx",
    ROOT / "素材" / "五上-人文综合涵养-寒假-第三讲-隐显-偷钱+第四讲-文言文-醉叟传1.docx",
    ROOT / "素材" / "五上-人文综合涵养-寒假-第七讲-阅读理解+作文点评2.docx",
]
RATIO_LIMITS = {
    "faithful": (0.83, 0.95),
    "concise": (0.26, 0.40),
    "study": (0.06, 0.14),
    "outline": (0.03, 0.08),
}


@pytest.mark.parametrize("sample", SAMPLES, ids=lambda path: path.name)
def test_build_chunk_scaffolds_real_word_ratios_and_preserve_spans(sample: Path) -> None:
    s0_result = parse_docx(sample)
    paragraphs = s0_result["paragraphs"]
    preclean_items = preclean(paragraphs)
    segments = segment(paragraphs)
    chunks = chunk(paragraphs, segments)
    course_types = infer_course_types(segments)

    assert len(preclean_items) == len(paragraphs)
    assert chunks

    pid_to_index = {paragraph["pid"]: index for index, paragraph in enumerate(paragraphs)}
    totals = {key: 0 for key in VERSION_KEYS}
    source_chars = 0
    saw_preserve_span = False

    for chunk_item in chunks:
        original_text = _chunk_text(paragraphs, pid_to_index, chunk_item)
        preserve_spans = chunk_item.get("must_preserve_spans", [])
        scaffolds = build_chunk_scaffolds(
            chunk_id=chunk_item["chunk_id"],
            title="",
            original_text=original_text,
            course_types=course_types,
            preserve_spans=preserve_spans,
        )
        source_chars += text_char_count(original_text)

        assert set(scaffolds) == set(VERSION_KEYS)
        for version_key, version in scaffolds.items():
            assert version["body_md"].strip()
            assert version["char_count"] > 0
            totals[version_key] += version["char_count"]

        for span in preserve_spans:
            span_text = _span_text(span)
            assert span_text in scaffolds["faithful"]["body_md"]
            cleaned = clean_transcript_text(original_text, preserve_spans=[span])
            assert span_text in cleaned["text"]
            saw_preserve_span = True

    assert saw_preserve_span
    for version_key, (lower, upper) in RATIO_LIMITS.items():
        ratio = totals[version_key] / source_chars
        assert lower <= ratio <= upper, (sample.name, version_key, ratio)


def test_transcript_cleaner_masks_preserve_spans_before_regex_cleanup() -> None:
    preserved = "霜落朔风乍起，这六个字要原样保留。"
    text = f"老师 00:01:02 嗯，这个{preserved}是不是啊？看屏幕。"

    cleaned = clean_transcript_text(text, preserve_spans=[preserved])

    assert preserved in cleaned["text"]
    assert "00:01:02" not in cleaned["text"]
    assert "看屏幕" not in cleaned["text"]


def test_quality_gates_ratio_levels_and_actions() -> None:
    assert check_version_ratio(
        version_key="faithful",
        actual_chars=900,
        source_chars=1000,
        preferred=(0.85, 0.93),
        hard=(0.70, 0.95),
    ) == {"ok": True, "level": "ok", "ratio": 0.9, "action": "accept"}

    assert check_version_ratio(
        version_key="concise",
        actual_chars=240,
        source_chars=1000,
        preferred=(0.28, 0.38),
        hard=(0.22, 0.45),
    ) == {"ok": True, "level": "warning", "ratio": 0.24, "action": "retry"}

    assert check_version_ratio(
        version_key="study",
        actual_chars=40,
        source_chars=1000,
        preferred=(0.08, 0.12),
        hard=(0.05, 0.15),
    ) == {"ok": False, "level": "risk", "ratio": 0.04, "action": "fallback"}

    assert check_version_ratio(
        version_key="faithful",
        actual_chars=980,
        source_chars=1000,
        preferred=(0.85, 0.93),
        hard=(0.70, 0.95),
    ) == {"ok": False, "level": "risk", "ratio": 0.98, "action": "fallback"}


def _chunk_text(
    paragraphs: list[dict[str, Any]],
    pid_to_index: dict[str, int],
    chunk_item: dict[str, Any],
) -> str:
    start_pid, end_pid = chunk_item["paragraph_range"]
    start_index = pid_to_index[start_pid]
    end_index = pid_to_index[end_pid]
    return "\n".join(paragraph["text"] for paragraph in paragraphs[start_index : end_index + 1])


def _span_text(span: Any) -> str:
    if isinstance(span, dict):
        return str(span.get("text") or "")
    return str(span)
