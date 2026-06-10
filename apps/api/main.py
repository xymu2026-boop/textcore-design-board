"""FastAPI application for TextCore."""

from __future__ import annotations

import io
import json
import uuid
import zipfile
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from html import escape
from typing import Annotated

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

from textcore.contracts.course_state import validate
from textcore.pipeline.events import StatusEventBroker
from textcore.pipeline.runner import run_fake_pipeline
from textcore.storage import CourseNotFoundError, CourseRepository

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
) -> Response:
    try:
        state = repo.get_state(course_id)
    except CourseNotFoundError as exc:
        raise HTTPException(status_code=404, detail="course not found") from exc

    filename = f"{course_id}.docx"
    content = _placeholder_docx_bytes(state["source"]["file"])
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _new_course_id() -> str:
    year = datetime.now(UTC).year
    return f"course_{year}_{uuid.uuid4().hex[:8]}"


def _placeholder_docx_bytes(source_filename: str) -> bytes:
    safe_source_filename = escape(source_filename)
    document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>TextCore placeholder export for {safe_source_filename}</w:t></w:r>
    </w:p>
    <w:sectPr/>
  </w:body>
</w:document>
"""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as docx:
        docx.writestr(
            "[Content_Types].xml",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
""",
        )
        docx.writestr(
            "_rels/.rels",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>
""",
        )
        docx.writestr("word/document.xml", document_xml)
    return buffer.getvalue()
