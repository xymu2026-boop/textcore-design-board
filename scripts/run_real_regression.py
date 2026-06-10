"""Manual real-LLM regression entry point.

This script is intentionally not called by CI, make check, or make regression.
Claude can run it manually with DEEPSEEK_API_KEY set when a real pipeline rerun is needed.
"""

from __future__ import annotations

import argparse
import asyncio
import os
from datetime import UTC, datetime
from pathlib import Path

from textcore.pipeline.events import StatusEventBroker
from textcore.pipeline.runner import run_fake_pipeline
from textcore.storage import CourseRepository

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "data" / "uploads" / "course_2026_652f24cc" / "source.docx"


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a manual real-LLM TextCore regression.")
    parser.add_argument("--course-id", default="course_real_regression")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()

    if not os.environ.get("DEEPSEEK_API_KEY"):
        raise SystemExit("DEEPSEEK_API_KEY is required for manual real regression.")
    if not args.source.exists():
        raise SystemExit(f"source docx not found: {args.source}")

    repo = CourseRepository()
    repo.migrate()
    _ensure_course_row(repo, args.course_id, args.source)
    asyncio.run(
        run_fake_pipeline(
            repository=repo,
            events=StatusEventBroker(),
            course_id=args.course_id,
            source_filename=args.source.name,
            source_path=args.source,
        )
    )
    print(f"real regression finished: {args.course_id}")
    return 0


def _ensure_course_row(repo: CourseRepository, course_id: str, source_path: Path) -> None:
    state_path = repo.processed_dir / course_id / "course_state.json"
    now = datetime.now(UTC).astimezone().isoformat(timespec="seconds")
    try:
        source_rel = str(source_path.relative_to(repo.data_dir))
    except ValueError:
        source_rel = str(source_path)
    with repo._connect() as conn:
        conn.execute(
            """
            INSERT INTO courses (
                course_id, title, teacher, type, status, review_count,
                updated_at, created_at, state_path, source_path
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(course_id) DO UPDATE SET
                status = excluded.status,
                updated_at = excluded.updated_at,
                state_path = excluded.state_path,
                source_path = excluded.source_path
            """,
            (
                course_id,
                source_path.stem,
                None,
                None,
                "created",
                0,
                now,
                now,
                str(state_path.relative_to(repo.data_dir)),
                source_rel,
            ),
        )


if __name__ == "__main__":
    raise SystemExit(main())
