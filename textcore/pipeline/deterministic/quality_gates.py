"""Deterministic ratio gates for version generation."""

from __future__ import annotations

from typing import Any

RatioRange = tuple[float, float]

DEFAULT_VERSION_RANGES: dict[str, dict[str, RatioRange]] = {
    "faithful": {"preferred": (0.85, 0.93), "hard": (0.70, 0.95)},
    "concise": {"preferred": (0.28, 0.38), "hard": (0.22, 0.45)},
    "study": {"preferred": (0.08, 0.12), "hard": (0.05, 0.15)},
    "outline": {"preferred": (0.04, 0.07), "hard": (0.03, 0.10)},
}


def check_version_ratio(
    *,
    version_key: str,
    actual_chars: int,
    source_chars: int,
    preferred: RatioRange | None = None,
    hard: RatioRange | None = None,
) -> dict[str, Any]:
    """Classify an output length against preferred and hard ratio ranges."""

    ranges = DEFAULT_VERSION_RANGES.get(version_key)
    if preferred is None:
        preferred = ranges["preferred"] if ranges else (0.0, 1.0)
    if hard is None:
        hard = ranges["hard"] if ranges else preferred

    ratio = round(actual_chars / source_chars, 4) if source_chars > 0 else 0.0
    if source_chars <= 0 or actual_chars <= 0:
        return {"ok": False, "level": "risk", "ratio": ratio, "action": "fallback"}

    if preferred[0] <= ratio <= preferred[1]:
        return {"ok": True, "level": "ok", "ratio": ratio, "action": "accept"}
    if hard[0] <= ratio <= hard[1]:
        return {"ok": True, "level": "warning", "ratio": ratio, "action": "retry"}
    return {"ok": False, "level": "risk", "ratio": ratio, "action": "fallback"}
