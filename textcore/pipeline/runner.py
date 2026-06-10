"""Pipeline runner for deterministic S0-S3 plus LLM-backed S4-S8."""

from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from textcore.classics.service import ClassicsService
from textcore.contracts.course_state import (
    DEFAULT_VERSION,
    SCHEMA_VERSION,
    STAGES,
    VERSION_KEYS,
    load_example,
    validate,
)
from textcore.llm import LLMClient
from textcore.pipeline.events import StatusEventBroker, make_status_event
from textcore.pipeline.stages import s4_clean, s5_classics, s6_merge, s7_versions, s8_extract
from textcore.pipeline.stages.s0_parse import parse_docx
from textcore.pipeline.stages.s1_preclean import preclean
from textcore.pipeline.stages.s2_segment import segment
from textcore.pipeline.stages.s3_chunk import chunk, infer_course_types
from textcore.storage import CourseRepository

STAGE_SLEEP_SECONDS = 0.03


async def run_fake_pipeline(
    *,
    repository: CourseRepository,
    events: StatusEventBroker,
    course_id: str,
    source_filename: str,
    source_path: Path,
    llm_client: LLMClient | None = None,
    classics_service: ClassicsService | None = None,
) -> None:
    """Run the course pipeline.

    The historical function name is kept for the API call site. S0-S3 are
    deterministic, S4/S6/S7/S8 use `LLMClient`, and S5 is deterministic lookup.
    """

    repository.update_status(course_id, "processing")
    client = llm_client or LLMClient()
    classics = classics_service or ClassicsService()
    stage_log: list[dict[str, Any]] = []
    model_calls: list[dict[str, Any]] = []
    s0_result: dict[str, Any] = {"paragraphs": [], "detected_meta": {}}
    preclean_items: list[dict[str, Any]] = []
    segment_items: list[dict[str, Any]] = []
    chunk_items: list[dict[str, Any]] = []
    course_types: dict[str, Any] = {}
    chunk_results: list[dict[str, Any]] = []
    classics_refs: list[dict[str, Any]] = []
    global_result: dict[str, Any] = {}
    versions: dict[str, Any] = {}
    knowledge_cards: list[dict[str, Any]] = []
    writing_materials: list[dict[str, Any]] = []
    review_flags: list[dict[str, Any]] = []
    quality: dict[str, Any] = {}

    try:
        for index, stage in enumerate(STAGES):
            started_at = _now_iso()
            await events.publish(
                make_status_event(
                    course_id=course_id,
                    stage=stage,
                    stage_status="running",
                    overall_status="processing",
                    progress=index / len(STAGES),
                    message=f"{stage} running",
                )
            )
            await asyncio.sleep(STAGE_SLEEP_SECONDS)

            if stage == "S0":
                s0_result = parse_docx(source_path, source_filename)
            elif stage == "S1":
                preclean_items = preclean(s0_result["paragraphs"])
            elif stage == "S2":
                segment_items = segment(s0_result["paragraphs"])
            elif stage == "S3":
                chunk_items = chunk(s0_result["paragraphs"], segment_items)
                course_types = infer_course_types(segment_items)
            elif stage == "S4":
                chunk_results, calls = s4_clean.run(
                    chunks=chunk_items,
                    paragraphs=s0_result["paragraphs"],
                    llm_client=client,
                )
                model_calls.extend(calls)
            elif stage == "S5":
                classics_refs = s5_classics.run(
                    chunk_results=chunk_results,
                    classics_service=classics,
                )
            elif stage == "S6":
                global_result, calls = s6_merge.run(
                    chunk_results=chunk_results,
                    classics_refs=classics_refs,
                    course_types=course_types,
                    llm_client=client,
                )
                model_calls.extend(calls)
            elif stage == "S7":
                source = _source(
                    source_filename=source_filename,
                    source_path=source_path,
                    data_dir=repository.data_dir,
                    s0_result=s0_result,
                )
                versions, calls = s7_versions.run(
                    chunk_results=chunk_results,
                    classics_refs=classics_refs,
                    global_result=global_result,
                    source=source,
                    course_types=course_types,
                    llm_client=client,
                )
                model_calls.extend(calls)
            elif stage == "S8":
                knowledge_cards, writing_materials, calls = s8_extract.run(
                    chunk_results=chunk_results,
                    classics_refs=classics_refs,
                    global_result=global_result,
                    versions=versions,
                    llm_client=client,
                )
                model_calls.extend(calls)
            elif stage == "S9":
                review_flags = _aggregate_review_flags(
                    chunk_results=chunk_results,
                    classics_refs=classics_refs,
                    global_result=global_result,
                )
                quality = _quality(review_flags)

            ended_at = _now_iso()
            stage_log.append(
                {
                    "stage": stage,
                    "status": "done",
                    "started_at": started_at,
                    "ended_at": ended_at,
                    "note": _stage_note(
                        stage,
                        s0_result,
                        preclean_items,
                        segment_items,
                        chunk_items,
                        chunk_results,
                        classics_refs,
                        global_result,
                        versions,
                        knowledge_cards,
                        writing_materials,
                    ),
                }
            )
            is_final = stage == STAGES[-1]
            if is_final:
                state = _build_state(
                    course_id=course_id,
                    source_filename=source_filename,
                    source_path=source_path,
                    stage_log=stage_log,
                    model_calls=model_calls,
                    data_dir=repository.data_dir,
                    s0_result=s0_result,
                    preclean_items=preclean_items,
                    segment_items=segment_items,
                    chunk_items=chunk_items,
                    course_types=course_types,
                    chunk_results=chunk_results,
                    classics_refs=classics_refs,
                    global_result=global_result,
                    versions=versions,
                    knowledge_cards=knowledge_cards,
                    writing_materials=writing_materials,
                    review_flags=review_flags,
                    quality=quality,
                )
                repository.save_state(state)
            await events.publish(
                make_status_event(
                    course_id=course_id,
                    stage=stage,
                    stage_status="done",
                    overall_status="completed" if is_final else "processing",
                    progress=(index + 1) / len(STAGES),
                    message=f"{stage} done",
                )
            )
    except Exception:
        repository.update_status(course_id, "failed")
        await events.publish(
            make_status_event(
                course_id=course_id,
                stage=stage,
                stage_status="failed",
                overall_status="failed",
                progress=index / len(STAGES),
                message=f"{stage} failed",
            )
        )
        raise


def _build_state(
    *,
    course_id: str,
    source_filename: str,
    source_path: Path,
    stage_log: list[dict[str, Any]],
    model_calls: list[dict[str, Any]],
    data_dir: Path,
    s0_result: dict[str, Any],
    preclean_items: list[dict[str, Any]],
    segment_items: list[dict[str, Any]],
    chunk_items: list[dict[str, Any]],
    course_types: dict[str, Any],
    chunk_results: list[dict[str, Any]],
    classics_refs: list[dict[str, Any]],
    global_result: dict[str, Any],
    versions: dict[str, Any],
    knowledge_cards: list[dict[str, Any]],
    writing_materials: list[dict[str, Any]],
    review_flags: list[dict[str, Any]],
    quality: dict[str, Any],
) -> dict[str, Any]:
    state = deepcopy(load_example())
    state["course_id"] = course_id
    state["schema_version"] = SCHEMA_VERSION
    state["status"] = "completed"
    state["source"] = _source(
        source_filename=source_filename,
        source_path=source_path,
        data_dir=data_dir,
        s0_result=s0_result,
    )
    state["course_types"] = course_types
    state["paragraphs"] = s0_result["paragraphs"]
    state["preclean"] = preclean_items
    state["segments"] = segment_items
    state["chunks"] = chunk_items
    state["chunk_results"] = chunk_results
    state["classics_refs"] = classics_refs
    state["global"] = global_result
    state["versions"] = {key: versions[key] for key in VERSION_KEYS}
    state["default_version"] = DEFAULT_VERSION
    state["knowledge_cards"] = knowledge_cards
    state["writing_materials"] = writing_materials
    state["review_flags"] = review_flags
    state["quality"] = quality
    state["processing_log"] = {
        "stages": stage_log,
        "model_calls": model_calls,
        "cost": {"total_usd": 0, "total_tokens": _total_tokens(model_calls)},
    }
    validate(state)
    return state


def _source(
    *,
    source_filename: str,
    source_path: Path,
    data_dir: Path,
    s0_result: dict[str, Any],
) -> dict[str, Any]:
    return {
        "file": source_filename,
        "stored_path": _relative_path(source_path, data_dir),
        "imported_at": _now_iso(),
        "detected_meta": s0_result["detected_meta"],
    }


def _stage_note(
    stage: str,
    s0_result: dict[str, Any],
    preclean_items: list[dict[str, Any]],
    segment_items: list[dict[str, Any]],
    chunk_items: list[dict[str, Any]],
    chunk_results: list[dict[str, Any]],
    classics_refs: list[dict[str, Any]],
    global_result: dict[str, Any],
    versions: dict[str, Any],
    knowledge_cards: list[dict[str, Any]],
    writing_materials: list[dict[str, Any]],
) -> str:
    if stage == "S0":
        return f"parsed {len(s0_result['paragraphs'])} paragraphs"
    if stage == "S1":
        labeled = sum(1 for item in preclean_items if item["labels"])
        return f"preclean labels on {labeled} paragraphs"
    if stage == "S2":
        boundaries = sum(1 for item in segment_items if item["is_boundary"])
        return f"segmented {len(segment_items)} paragraphs, {boundaries} boundaries"
    if stage == "S3":
        return f"built {len(chunk_items)} chunks"
    if stage == "S4":
        return f"cleaned {len(chunk_results)} chunks"
    if stage == "S5":
        matched = sum(1 for ref in classics_refs if ref.get("matched"))
        return f"looked up {len(classics_refs)} classics refs, {matched} matched"
    if stage == "S6":
        outlines = len(global_result.get("outline_tree", []))
        return f"merged global outline with {outlines} top-level nodes"
    if stage == "S7":
        return f"generated {len(versions)} versions"
    if stage == "S8":
        return f"extracted {len(knowledge_cards)} cards and {len(writing_materials)} materials"
    if stage == "S9":
        return "aggregated review flags and quality"
    if stage == "S10":
        return "validated and saved course state"
    return "done"


def _aggregate_review_flags(
    *,
    chunk_results: list[dict[str, Any]],
    classics_refs: list[dict[str, Any]],
    global_result: dict[str, Any],
) -> list[dict[str, Any]]:
    flags: list[dict[str, Any]] = []
    for chunk_result in chunk_results:
        for flag in chunk_result.get("review_flags", []):
            flags.append(_with_flag_defaults(flag, chunk_result["chunk_id"], len(flags) + 1))
    for flag in global_result.get("merged_review_flags", []):
        flags.append(_with_flag_defaults(flag, flag.get("chunk_id", ""), len(flags) + 1))
    for ref in classics_refs:
        for diff in ref.get("diffs", []):
            flag = {
                "pid": diff.get("pid", ""),
                "chunk_id": ref["chunk_id"],
                "text": diff["raw"],
                "suggestion": diff["canonical"],
                "reason": "S5 classics reference diff",
                "category": "classical_typo",
                "severity": "medium",
                "status": "open",
            }
            flags.append(_with_flag_defaults(flag, ref["chunk_id"], len(flags) + 1))
    return _dedupe_flags(flags)


def _with_flag_defaults(flag: dict[str, Any], chunk_id: str, index: int) -> dict[str, Any]:
    out = dict(flag)
    out.setdefault("flag_id", f"rf_{index:03d}")
    if chunk_id:
        out.setdefault("chunk_id", chunk_id)
    out.setdefault("category", "other")
    out.setdefault("severity", "medium")
    out.setdefault("status", "open")
    return {key: value for key, value in out.items() if value != ""}


def _dedupe_flags(flags: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[Any, ...]] = set()
    deduped: list[dict[str, Any]] = []
    for flag in flags:
        key = (
            flag.get("pid"),
            flag.get("chunk_id"),
            flag.get("text"),
            flag.get("suggestion"),
            flag.get("reason"),
        )
        if key in seen:
            continue
        seen.add(key)
        flag["flag_id"] = f"rf_{len(deduped) + 1:03d}"
        deduped.append(flag)
    return deduped


def _quality(review_flags: list[dict[str, Any]]) -> dict[str, Any]:
    high_count = sum(1 for flag in review_flags if flag.get("severity") == "high")
    score = max(0, 92 - high_count * 12 - len(review_flags) * 3)
    return {
        "quality_score": score,
        "coverage": "good" if score >= 75 else "fair",
        "main_risks": [flag["reason"] for flag in review_flags[:5]],
        "recommended_human_review": bool(review_flags),
    }


def _total_tokens(model_calls: list[dict[str, Any]]) -> int:
    return sum(
        call.get("prompt_tokens", 0) + call.get("completion_tokens", 0)
        for call in model_calls
    )


def _relative_path(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def _now_iso() -> str:
    return datetime.now(UTC).astimezone().isoformat(timespec="seconds")
