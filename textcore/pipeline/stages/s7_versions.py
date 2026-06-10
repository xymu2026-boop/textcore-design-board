"""S7 four-tier version generation."""

from __future__ import annotations

from typing import Any

from textcore.contracts.course_state import VERSION_KEYS, validate_subschema
from textcore.llm import LLMClient
from textcore.pipeline.llm_stage import dump_payload, model_call, property_schema
from textcore.pipeline.prompts import load_stage_prompt


def run(
    *,
    chunk_results: list[dict[str, Any]],
    classics_refs: list[dict[str, Any]],
    global_result: dict[str, Any],
    source: dict[str, Any],
    course_types: dict[str, Any],
    llm_client: LLMClient,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    system = load_stage_prompt(
        "s7_versions.system.md",
        rules=("classics_protection.md", "essay_feedback.md"),
    )
    schema = property_schema("versions")
    user = dump_payload(
        {
            "source": source,
            "course_types": course_types,
            "global": global_result,
            "chunk_results": chunk_results,
            "classics_refs": classics_refs,
            "version_keys": VERSION_KEYS,
        }
    )
    obj, result = llm_client.complete_json(system, user, schema, stage="S7")
    for key in VERSION_KEYS:
        validate_subschema(obj[key], "version")
    return obj, [model_call("S7", result)]
