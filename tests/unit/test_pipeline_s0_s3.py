from __future__ import annotations

from copy import deepcopy
from pathlib import Path

from textcore.contracts.course_state import (
    DEFAULT_VERSION,
    SCHEMA_VERSION,
    VERSION_KEYS,
    load_example,
    validate,
)
from textcore.pipeline.stages.s0_parse import parse_docx
from textcore.pipeline.stages.s1_preclean import preclean
from textcore.pipeline.stages.s2_segment import segment
from textcore.pipeline.stages.s3_chunk import chunk, infer_course_types

ROOT = Path(__file__).resolve().parents[2]
SAMPLE = ROOT / "素材" / "五上-人文综合涵养-寒假-第三讲-隐显-偷钱+第四讲-文言文-醉叟传1.docx"


def test_s0_s3_parse_real_docx_and_validate_course_state() -> None:
    s0_result = parse_docx(SAMPLE)
    paragraphs = s0_result["paragraphs"]
    preclean_items = preclean(paragraphs)
    segments = segment(paragraphs)
    chunks = chunk(paragraphs, segments)

    assert len(paragraphs) > 100
    assert all(paragraph["pid"] and paragraph["source_order"] for paragraph in paragraphs)
    assert all(paragraph["pid"] == f"p{index:04d}" for index, paragraph in enumerate(paragraphs, 1))
    assert any(paragraph.get("speaker") == "陈细影" for paragraph in paragraphs)
    assert any(paragraph.get("ts") == "00:00:09" for paragraph in paragraphs)

    assert len(preclean_items) == len(paragraphs)
    assert len(segments) == len(paragraphs)
    assert 3 <= len(chunks) < len(paragraphs) // 3
    assert any(chunk_item["must_preserve_spans"] for chunk_item in chunks)

    _assert_preserved_segments_not_split(paragraphs, segments, chunks)

    state = deepcopy(load_example())
    state["course_id"] = "course_test_s0_s3"
    state["schema_version"] = SCHEMA_VERSION
    state["source"]["file"] = SAMPLE.name
    state["source"]["stored_path"] = str(SAMPLE.relative_to(ROOT))
    state["source"]["detected_meta"] = s0_result["detected_meta"]
    state["course_types"] = infer_course_types(segments)
    state["paragraphs"] = paragraphs
    state["preclean"] = preclean_items
    state["segments"] = segments
    state["chunks"] = chunks
    state["versions"] = {key: state["versions"][key] for key in VERSION_KEYS}
    state["default_version"] = DEFAULT_VERSION

    validate(state)


def _assert_preserved_segments_not_split(
    paragraphs: list[dict[str, object]],
    segments: list[dict[str, object]],
    chunks: list[dict[str, object]],
) -> None:
    pid_to_index = {paragraph["pid"]: index for index, paragraph in enumerate(paragraphs)}
    pid_to_chunk = {}
    for chunk_item in chunks:
        start, end = chunk_item["paragraph_range"]
        start_index = pid_to_index[start]
        end_index = pid_to_index[end]
        for paragraph in paragraphs[start_index : end_index + 1]:
            pid_to_chunk[paragraph["pid"]] = chunk_item["chunk_id"]

    preserve_pids = [
        segment_item["pid"]
        for segment_item in segments
        if segment_item["segment_type"] in {"文言文原文", "古诗词"}
    ]
    assert preserve_pids
    assert all(pid in pid_to_chunk for pid in preserve_pids)

    group: list[str] = []
    previous_index: int | None = None
    for pid in preserve_pids:
        index = pid_to_index[pid]
        if previous_index is not None and index != previous_index + 1:
            _assert_one_chunk(group, pid_to_chunk)
            group = []
        group.append(pid)
        previous_index = index
    _assert_one_chunk(group, pid_to_chunk)


def _assert_one_chunk(group: list[str], pid_to_chunk: dict[object, object]) -> None:
    if not group:
        return
    assert len({pid_to_chunk[pid] for pid in group}) == 1
