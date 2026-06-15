"""Score TextCore course quality with the deterministic rubric."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from textcore.pipeline.deterministic.quality_rubric import SCORE_KEYS, score_course  # noqa: E402

SCORE_COLUMNS = (*SCORE_KEYS, "overall")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Score one or more TextCore course_state.json files."
    )
    parser.add_argument("target", nargs="?", help="course_state.json path or processed course_id")
    parser.add_argument(
        "--all",
        action="store_true",
        help="score every data/processed/*/course_state.json file",
    )
    args = parser.parse_args()
    if args.all and args.target:
        parser.error("--all cannot be combined with a target")
    if not args.all and not args.target:
        parser.error("target or --all is required")

    if args.all:
        paths = sorted((ROOT / "data" / "processed").glob("*/course_state.json"))
        rows = [_score_path(path) for path in paths]
        _print_table(rows)
        return 0

    path = _resolve_target(args.target)
    row = _score_path(path)
    for key, value in row.items():
        print(f"{key}: {value}")
    return 0


def _resolve_target(target: str) -> Path:
    path = Path(target)
    if path.exists():
        return path

    processed_path = ROOT / "data" / "processed" / target / "course_state.json"
    if processed_path.exists():
        return processed_path

    raise SystemExit(f"course_state not found: {target}")


def _score_path(path: Path) -> dict[str, Any]:
    state = json.loads(path.read_text(encoding="utf-8"))
    scores = score_course(state)
    row: dict[str, Any] = {
        "course": _course_name(state, path),
        "course_id": state.get("course_id") or path.parent.name,
    }
    row.update({key: scores[key] for key in SCORE_COLUMNS})
    return row


def _course_name(state: dict[str, Any], path: Path) -> str:
    source = state.get("source")
    if isinstance(source, dict):
        filename = str(source.get("file") or "").strip()
        if filename:
            return Path(filename).stem
    course_id = str(state.get("course_id") or "").strip()
    return course_id or path.parent.name


def _print_table(rows: list[dict[str, Any]]) -> None:
    columns = ("course_id", "course", *SCORE_COLUMNS)
    widths = {
        column: max(len(column), *(len(str(row.get(column, ""))) for row in rows))
        for column in columns
    }
    print(" | ".join(column.ljust(widths[column]) for column in columns))
    print("-+-".join("-" * widths[column] for column in columns))
    for row in rows:
        print(" | ".join(str(row.get(column, "")).ljust(widths[column]) for column in columns))


if __name__ == "__main__":
    raise SystemExit(main())
