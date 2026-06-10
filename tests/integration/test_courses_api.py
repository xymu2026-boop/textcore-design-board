from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

from fastapi.testclient import TestClient

from apps.api.main import app, get_event_broker, get_repository
from textcore.contracts.course_state import DEFAULT_VERSION, STAGES, VERSION_KEYS, validate
from textcore.pipeline.events import StatusEventBroker
from textcore.storage import CourseRepository


def test_upload_list_detail_events_and_export(tmp_path: Path) -> None:
    repo = CourseRepository(tmp_path)
    repo.migrate()
    broker = StatusEventBroker()
    app.dependency_overrides[get_repository] = lambda: repo
    app.dependency_overrides[get_event_broker] = lambda: broker

    try:
        with TestClient(app) as client:
            upload = client.post(
                "/api/courses/upload",
                files={
                    "file": (
                        "lesson.docx",
                        b"placeholder docx bytes",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    )
                },
            )
            assert upload.status_code == 200
            course_id = upload.json()["course_id"]

            course_list = client.get("/api/courses")
            assert course_list.status_code == 200
            items = course_list.json()
            assert [item["course_id"] for item in items] == [course_id]
            assert items[0]["status"] == "completed"
            assert items[0]["review_count"] == 1

            detail = client.get(f"/api/courses/{course_id}")
            assert detail.status_code == 200
            state = detail.json()
            validate(state)
            assert state["course_id"] == course_id
            assert state["source"]["file"] == "lesson.docx"
            assert set(state["versions"]) == set(VERSION_KEYS)
            assert state["default_version"] == DEFAULT_VERSION

            with client.stream("GET", f"/api/courses/{course_id}/events") as response:
                assert response.status_code == 200
                events = _parse_sse(response.iter_text())
            assert [event["stage"] for event in events if event["stage_status"] == "done"] == list(
                STAGES
            )
            assert events[-1]["stage"] == "S10"
            assert events[-1]["overall_status"] == "completed"

            export = client.post(f"/api/courses/{course_id}/export")
            assert export.status_code == 200
            assert export.content.startswith(b"PK")
            assert (
                export.headers["content-type"]
                == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
    finally:
        app.dependency_overrides.clear()


def _parse_sse(chunks: Iterator[str]) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []
    for chunk in chunks:
        for line in chunk.splitlines():
            if line.startswith("data: "):
                events.append(json.loads(line.removeprefix("data: ")))
    return events
