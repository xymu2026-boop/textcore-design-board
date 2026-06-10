"""Fake S0-S10 pipeline runner for the API placeholder loop."""

from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from textcore.contracts.course_state import (
    DEFAULT_VERSION,
    SCHEMA_VERSION,
    STAGES,
    VERSION_KEYS,
    load_example,
    validate,
)
from textcore.pipeline.events import StatusEventBroker, make_status_event
from textcore.storage import CourseRepository

STAGE_SLEEP_SECONDS = 0.03


async def run_fake_pipeline(
    *,
    repository: CourseRepository,
    events: StatusEventBroker,
    course_id: str,
    source_filename: str,
    source_path: Path,
) -> None:
    """Generate a valid course_state from the frozen example and emit progress."""

    repository.update_status(course_id, "processing")
    stage_log: list[dict[str, Any]] = []

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
        ended_at = _now_iso()
        stage_log.append(
            {
                "stage": stage,
                "status": "done",
                "started_at": started_at,
                "ended_at": ended_at,
                "note": "fake pipeline placeholder",
            }
        )
        is_final = stage == STAGES[-1]
        if is_final:
            state = _build_fake_state(
                course_id=course_id,
                source_filename=source_filename,
                source_path=source_path,
                stage_log=stage_log,
                data_dir=repository.data_dir,
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


def _build_fake_state(
    *,
    course_id: str,
    source_filename: str,
    source_path: Path,
    stage_log: list[dict[str, Any]],
    data_dir: Path,
) -> dict[str, Any]:
    state = deepcopy(load_example())
    state["course_id"] = course_id
    state["schema_version"] = SCHEMA_VERSION
    state["status"] = "completed"
    state["source"]["file"] = source_filename
    state["source"]["stored_path"] = str(source_path.relative_to(data_dir))
    state["source"]["imported_at"] = _now_iso()
    state["versions"] = {key: state["versions"][key] for key in VERSION_KEYS}
    state["default_version"] = DEFAULT_VERSION
    state["processing_log"] = {
        "stages": stage_log,
        "model_calls": [],
        "cost": {"total_usd": 0, "total_tokens": 0},
    }
    validate(state)
    return state


def _now_iso() -> str:
    return datetime.now(UTC).astimezone().isoformat(timespec="seconds")
