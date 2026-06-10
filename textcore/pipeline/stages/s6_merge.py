"""S6 global merge."""

from __future__ import annotations

from typing import Any

from textcore.llm import LLMClient
from textcore.pipeline.llm_stage import dump_payload, model_call, property_schema
from textcore.pipeline.prompts import load_stage_prompt


def run(
    *,
    chunk_results: list[dict[str, Any]],
    classics_refs: list[dict[str, Any]],
    course_types: dict[str, Any],
    llm_client: LLMClient,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    system = load_stage_prompt("s6_merge.system.md")
    schema = property_schema("global")
    user = dump_payload(
        {
            "course_types": course_types,
            "chunk_results": chunk_results,
            "classics_refs": classics_refs,
        }
    )
    obj, result = llm_client.complete_json(system, user, schema, stage="S6")
    return obj, [model_call("S6", result)]
