from __future__ import annotations

import io
import json
from collections.abc import Iterator
from pathlib import Path

from docx import Document
from fastapi.testclient import TestClient

import apps.api.main as api_main
from apps.api.main import app, get_event_broker, get_repository
from textcore.contracts.course_state import DEFAULT_VERSION, STAGES, VERSION_KEYS, validate
from textcore.llm import LLMClient, MockProvider
from textcore.pipeline.events import StatusEventBroker
from textcore.pipeline.runner import run_fake_pipeline
from textcore.storage import CourseRepository


def test_upload_list_detail_events_and_export(tmp_path: Path, monkeypatch) -> None:
    repo = CourseRepository(tmp_path)
    repo.migrate()
    broker = StatusEventBroker()
    llm_client = LLMClient(MockProvider(_mock_pipeline_response))

    async def run_pipeline_with_mock(**kwargs):
        await run_fake_pipeline(**kwargs, llm_client=llm_client)

    monkeypatch.setattr(api_main, "run_fake_pipeline", run_pipeline_with_mock)
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

            export = client.post(
                f"/api/courses/{course_id}/export",
                json={"sections": ["summary", "concise", "review"], "format": "printable"},
            )
            assert export.status_code == 200
            assert export.content.startswith(b"PK")
            assert (
                export.headers["content-type"]
                == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
            exported_doc = Document(io.BytesIO(export.content))
            exported_text = "\n".join(paragraph.text for paragraph in exported_doc.paragraphs)
            assert "课程摘要" in exported_text
            assert "精简整理" in exported_text
            assert "复核标记" in exported_text
            assert "保真清洗" not in exported_text
    finally:
        app.dependency_overrides.clear()


def _parse_sse(chunks: Iterator[str]) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []
    for chunk in chunks:
        for line in chunk.splitlines():
            if line.startswith("data: "):
                events.append(json.loads(line.removeprefix("data: ")))
    return events


def _mock_pipeline_response(system: str, _user: str) -> str:
    if "S4 分块保真清洗" in system:
        return _json(
            {
                "chunk_id": "c001",
                "cleaned_text": "保真清洗后的课堂内容。",
                "key_points": ["课堂主线"],
                "student_answer_kept": [],
                "review_flags": [
                    {
                        "text": "占位复核",
                        "reason": "API 集成测试保留一个复核项",
                        "category": "other",
                        "severity": "low",
                        "status": "open",
                    }
                ],
                "entities": {"persons": [], "works": [], "concepts": ["课堂主线"]},
                "classics_candidates": [],
            }
        )
    if "S6 全局合并" in system:
        return _json(
            {
                "course_summary": "课堂内容摘要。",
                "outline_tree": [
                    {
                        "title": "一、课堂主线",
                        "level": 2,
                        "anchor": "c001",
                        "chunk_ids": ["c001"],
                        "children": [],
                    }
                ],
                "main_themes": ["课堂主线"],
                "merged_review_flags": [],
            }
        )
    if "S7 四档版本生成" in system:
        return _json(
            {
                "faithful": {
                    "body_md": "## 保真清洗\n课堂内容。",
                    "compression": 0.9,
                    "char_count": 12,
                },
                "concise": {
                    "body_md": "## 精简整理\n课堂主线。",
                    "compression": 0.31,
                    "char_count": 12,
                },
                "study": {"body_md": "- 课堂主线", "compression": 0.09, "char_count": 6},
                "outline": {"body_md": "- 课堂主线", "compression": 0.05, "char_count": 6},
            }
        )
    if "S8 知识卡片抽取" in system:
        return _json({"knowledge_cards": []})
    if "S8 作文素材抽取" in system:
        return _json({"writing_materials": []})
    raise AssertionError(f"unexpected prompt: {system[:120]}")


def _json(payload: dict[str, object]) -> str:
    return json.dumps(payload, ensure_ascii=False)
