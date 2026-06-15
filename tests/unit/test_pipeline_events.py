from __future__ import annotations

import asyncio
import json
from pathlib import Path
from threading import Thread

import jsonschema

from textcore.pipeline.events import StatusEventBroker, make_status_event

ROOT = Path(__file__).resolve().parents[2]
STATUS_SCHEMA_PATH = ROOT / "schemas" / "api" / "status_event.schema.json"


def test_status_event_accepts_optional_chunk_fields() -> None:
    schema = json.loads(STATUS_SCHEMA_PATH.read_text(encoding="utf-8"))
    event = make_status_event(
        course_id="course_events",
        stage="S4",
        stage_status="running",
        overall_status="processing",
        progress=0.42,
        message="清洗 2/5 块",
        chunk_index=2,
        chunk_total=5,
    )

    jsonschema.Draft202012Validator(schema).validate(event)
    assert event["chunk_index"] == 2
    assert event["chunk_total"] == 5


def test_status_event_broker_streams_threadsafe_publishers() -> None:
    broker = StatusEventBroker()

    def publish_range(start: int, end: int) -> None:
        for index in range(start, end):
            broker.publish_threadsafe(
                make_status_event(
                    course_id="course_events",
                    stage="S4",
                    stage_status="running",
                    overall_status="processing",
                    progress=index / 20,
                    message=f"清洗 {index}/20 块",
                    chunk_index=index,
                    chunk_total=20,
                )
            )

    async def collect_events() -> list[dict[str, object]]:
        events: list[dict[str, object]] = []
        stream_task = asyncio.create_task(_collect_stream(broker, "course_events", events))
        await asyncio.sleep(0)
        threads = [
            Thread(target=publish_range, args=(1, 11)),
            Thread(target=publish_range, args=(11, 21)),
        ]
        for thread in threads:
            thread.start()
        await asyncio.to_thread(lambda: [thread.join() for thread in threads])
        await broker.publish(
            make_status_event(
                course_id="course_events",
                stage="S10",
                stage_status="done",
                overall_status="completed",
                progress=1,
                message="S10 done",
            )
        )
        await stream_task
        return events

    events = asyncio.run(collect_events())
    chunk_events = [event for event in events if event["stage"] == "S4"]

    assert len(chunk_events) == 20
    assert sorted(event["chunk_index"] for event in chunk_events) == list(range(1, 21))
    assert events[-1]["stage"] == "S10"


async def _collect_stream(
    broker: StatusEventBroker,
    course_id: str,
    events: list[dict[str, object]],
) -> None:
    async for event in broker.stream(course_id):
        events.append(event)
