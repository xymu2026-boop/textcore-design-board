"""FastAPI application for TextCore."""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Annotated

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from textcore.config import load_env
from textcore.contracts.course_state import validate
from textcore.exporters.docx_export import DEFAULT_EXPORT_SECTIONS, export_course_docx
from textcore.pipeline.events import StatusEventBroker
from textcore.pipeline.runner import run_fake_pipeline
from textcore.storage import CourseNotFoundError, CourseRepository

load_env()  # 读 .env.local（DEEPSEEK_API_KEY 等），密钥不入库

repository = CourseRepository()
event_broker = StatusEventBroker()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    repository.migrate()
    yield


app = FastAPI(title="TextCore API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_repository() -> CourseRepository:
    return repository


def get_event_broker() -> StatusEventBroker:
    return event_broker


class ExportRequest(BaseModel):
    sections: list[str] = Field(default_factory=lambda: list(DEFAULT_EXPORT_SECTIONS))
    format: str = "printable"
    version: str | None = None


@app.get("/health")
def health() -> dict[str, str]:
    """Return the API health status."""
    return {"status": "ok"}


@app.post("/api/courses/upload")
async def upload_course(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    repo: Annotated[CourseRepository, Depends(get_repository)],
    events: Annotated[StatusEventBroker, Depends(get_event_broker)],
) -> dict[str, str]:
    if not (file.filename or "").lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="only .docx uploads are supported")

    course_id = _new_course_id()
    source_path = repo.create_course(course_id, file)
    background_tasks.add_task(
        run_fake_pipeline,
        repository=repo,
        events=events,
        course_id=course_id,
        source_filename=file.filename or "source.docx",
        source_path=source_path,
    )
    return {"course_id": course_id}


@app.get("/api/courses")
def list_courses(
    repo: Annotated[CourseRepository, Depends(get_repository)],
) -> list[dict[str, object]]:
    return repo.list_courses()


@app.get("/api/courses/{course_id}")
def get_course(
    course_id: str,
    repo: Annotated[CourseRepository, Depends(get_repository)],
) -> dict[str, object]:
    try:
        state = repo.get_state(course_id)
    except CourseNotFoundError as exc:
        raise HTTPException(status_code=404, detail="course not found") from exc
    validate(state)
    return state


@app.get("/api/courses/{course_id}/events")
async def course_events(
    course_id: str,
    repo: Annotated[CourseRepository, Depends(get_repository)],
    events: Annotated[StatusEventBroker, Depends(get_event_broker)],
) -> StreamingResponse:
    if not any(item["course_id"] == course_id for item in repo.list_courses()):
        raise HTTPException(status_code=404, detail="course not found")

    async def event_stream() -> AsyncIterator[str]:
        async for event in events.stream(course_id):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/courses/{course_id}/export")
def export_course(
    course_id: str,
    repo: Annotated[CourseRepository, Depends(get_repository)],
    payload: ExportRequest | None = None,
) -> Response:
    try:
        state = repo.get_state(course_id)
    except CourseNotFoundError as exc:
        raise HTTPException(status_code=404, detail="course not found") from exc

    filename = f"{course_id}.docx"
    request = payload or ExportRequest()
    content = export_course_docx(
        state,
        sections=request.sections,
        export_format=request.format,
        current_version=request.version,
    )
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _new_course_id() -> str:
    year = datetime.now(UTC).year
    return f"course_{year}_{uuid.uuid4().hex[:8]}"
