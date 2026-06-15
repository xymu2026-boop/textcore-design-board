"""In-memory status event log for pipeline SSE."""

from __future__ import annotations

import asyncio
from collections import defaultdict
from collections.abc import AsyncIterator
from copy import deepcopy
from datetime import UTC, datetime
from threading import Condition
from typing import Any

from textcore.contracts.course_state import STAGES

STAGE_LABELS = {
    "S0": "解析 Word",
    "S1": "预清洗",
    "S2": "课型识别",
    "S3": "语义分块",
    "S4": "分块清洗",
    "S5": "古文查证",
    "S6": "全局合并",
    "S7": "生成版本",
    "S8": "知识素材",
    "S9": "复核汇总",
    "S10": "完成入库",
}


class StatusEventBroker:
    """Stores events per course and streams them to SSE clients."""

    def __init__(self) -> None:
        self._events: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self._condition = Condition()

    async def publish(self, event: dict[str, Any]) -> None:
        self.publish_threadsafe(event)

    def publish_threadsafe(self, event: dict[str, Any]) -> None:
        """Publish from the event loop or worker threads."""

        with self._condition:
            self._events[event["course_id"]].append(deepcopy(event))
            self._condition.notify_all()

    async def stream(self, course_id: str) -> AsyncIterator[dict[str, Any]]:
        index = 0
        while True:
            event = await asyncio.to_thread(self._wait_for_event, course_id, index)
            index += 1
            yield event
            if event["stage"] == STAGES[-1] and event["stage_status"] == "done":
                break

    def _wait_for_event(self, course_id: str, index: int) -> dict[str, Any]:
        with self._condition:
            while index >= len(self._events[course_id]):
                self._condition.wait()
            return deepcopy(self._events[course_id][index])


def make_status_event(
    *,
    course_id: str,
    stage: str,
    stage_status: str,
    overall_status: str,
    progress: float,
    message: str,
    chunk_index: int | None = None,
    chunk_total: int | None = None,
) -> dict[str, Any]:
    event = {
        "course_id": course_id,
        "stage": stage,
        "stage_label": STAGE_LABELS.get(stage, stage),
        "stage_status": stage_status,
        "overall_status": overall_status,
        "progress": progress,
        "message": message,
        "ts": datetime.now(UTC).astimezone().isoformat(timespec="seconds"),
    }
    if chunk_index is not None:
        event["chunk_index"] = chunk_index
    if chunk_total is not None:
        event["chunk_total"] = chunk_total
    return event
