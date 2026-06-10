"""SQLite-backed storage for TextCore course state."""

from __future__ import annotations

import json
import shutil
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import UploadFile

from textcore.contracts.course_state import validate

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = ROOT / "data"


COURSE_TYPE_LABELS = {
    "modern_reading": "现代文阅读",
    "essay_method": "作文方法",
    "essay_feedback": "作文点评",
    "classical_chinese": "文言文",
    "poetry": "古诗词",
    "humanities_story": "人文故事",
    "test_strategy": "应试策略",
    "mixed": "混合课",
}


class CourseNotFoundError(KeyError):
    """Raised when a course id is not present in storage."""


class CourseRepository:
    """Repository that keeps full state in JSON and list projections in SQLite."""

    def __init__(self, data_dir: Path = DEFAULT_DATA_DIR) -> None:
        self.data_dir = data_dir
        self.db_path = data_dir / "db" / "textcore.db"
        self.uploads_dir = data_dir / "uploads"
        self.processed_dir = data_dir / "processed"

    def migrate(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS courses (
                    course_id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    teacher TEXT,
                    type TEXT,
                    status TEXT NOT NULL,
                    review_count INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    state_path TEXT,
                    source_path TEXT
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_courses_updated_at ON courses(updated_at)"
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status)")

    def create_course(self, course_id: str, upload: UploadFile) -> Path:
        now = _now_iso()
        course_dir = self.uploads_dir / course_id
        course_dir.mkdir(parents=True, exist_ok=True)
        source_path = course_dir / "source.docx"
        with source_path.open("wb") as file:
            shutil.copyfileobj(upload.file, file)

        title = Path(upload.filename or "source.docx").stem or course_id
        state_path = self._state_path(course_id)
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO courses (
                    course_id, title, teacher, type, status, review_count,
                    updated_at, created_at, state_path, source_path
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    course_id,
                    title,
                    None,
                    None,
                    "created",
                    0,
                    now,
                    now,
                    str(state_path.relative_to(self.data_dir)),
                    str(source_path.relative_to(self.data_dir)),
                ),
            )
        return source_path

    def save_state(self, state: dict[str, Any]) -> None:
        validate(state)
        course_id = state["course_id"]
        path = self._state_path(course_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")

        projection = self._project_state(state, path)
        with self._connect() as conn:
            existing = conn.execute(
                "SELECT created_at FROM courses WHERE course_id = ?",
                (course_id,),
            ).fetchone()
            created_at = existing["created_at"] if existing else projection["updated_at"]
            conn.execute(
                """
                INSERT INTO courses (
                    course_id, title, teacher, type, status, review_count,
                    updated_at, created_at, state_path, source_path
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(course_id) DO UPDATE SET
                    title = excluded.title,
                    teacher = excluded.teacher,
                    type = excluded.type,
                    status = excluded.status,
                    review_count = excluded.review_count,
                    updated_at = excluded.updated_at,
                    state_path = excluded.state_path,
                    source_path = excluded.source_path
                """,
                (
                    course_id,
                    projection["title"],
                    projection.get("teacher"),
                    projection.get("type"),
                    projection["status"],
                    projection["review_count"],
                    projection["updated_at"],
                    created_at,
                    projection["state_path"],
                    projection.get("source_path"),
                ),
            )

    def get_state(self, course_id: str) -> dict[str, Any]:
        row = self._course_row(course_id)
        state_path = row["state_path"]
        if not state_path:
            raise CourseNotFoundError(course_id)
        path = self.data_dir / state_path
        if not path.exists():
            raise CourseNotFoundError(course_id)
        state = json.loads(path.read_text(encoding="utf-8"))
        validate(state)
        return state

    def list_courses(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT course_id, title, teacher, type, status, review_count, updated_at
                FROM courses
                ORDER BY updated_at DESC, created_at DESC
                """
            ).fetchall()
        return [_without_none(dict(row)) for row in rows]

    def update_status(self, course_id: str, status: str) -> None:
        with self._connect() as conn:
            result = conn.execute(
                "UPDATE courses SET status = ?, updated_at = ? WHERE course_id = ?",
                (status, _now_iso(), course_id),
            )
        if result.rowcount == 0:
            raise CourseNotFoundError(course_id)

    def _state_path(self, course_id: str) -> Path:
        return self.processed_dir / course_id / "course_state.json"

    def _course_row(self, course_id: str) -> sqlite3.Row:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM courses WHERE course_id = ?",
                (course_id,),
            ).fetchone()
        if row is None:
            raise CourseNotFoundError(course_id)
        return row

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _project_state(self, state: dict[str, Any], path: Path) -> dict[str, Any]:
        source = state.get("source", {})
        meta = source.get("detected_meta", {})
        title = meta.get("course_title") or source.get("file") or state["course_id"]
        dominant_type = state.get("course_types", {}).get("dominant_type")
        review_count = sum(
            1 for flag in state.get("review_flags", []) if flag.get("status", "open") == "open"
        )
        return {
            "title": title,
            "teacher": meta.get("teacher"),
            "type": COURSE_TYPE_LABELS.get(dominant_type, dominant_type),
            "status": state["status"],
            "review_count": review_count,
            "updated_at": _now_iso(),
            "state_path": str(path.relative_to(self.data_dir)),
            "source_path": source.get("stored_path"),
        }


def _now_iso() -> str:
    return datetime.now(UTC).astimezone().isoformat(timespec="seconds")


def _without_none(row: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in row.items() if value is not None}
