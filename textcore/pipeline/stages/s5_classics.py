"""S5 deterministic classics reference lookup."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from textcore.classics.service import ClassicsService
from textcore.contracts.course_state import validate_subschema


def run(
    *,
    chunk_results: list[dict[str, Any]],
    classics_service: ClassicsService,
) -> list[dict[str, Any]]:
    candidates = _collect_candidates(chunk_results)
    refs = classics_service.lookup_candidates(candidates)
    for ref in refs:
        validate_subschema(ref, "classicsRef")
    return refs


def _collect_candidates(chunk_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for chunk_result in chunk_results:
        chunk_id = chunk_result["chunk_id"]
        for candidate in chunk_result.get("classics_candidates", []):
            enriched = deepcopy(candidate)
            enriched["chunk_id"] = chunk_id
            enriched["ref_id"] = f"ref_{len(candidates) + 1:03d}"
            candidates.append(enriched)
    return candidates
