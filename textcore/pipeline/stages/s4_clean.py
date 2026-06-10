"""S4 chunk-level faithful cleaning."""

from __future__ import annotations

from typing import Any

from textcore.contracts.course_state import validate_subschema
from textcore.llm import LLMClient
from textcore.pipeline.llm_stage import (
    def_schema,
    dump_payload,
    model_call,
    paragraph_text_for_chunk,
    protected_spans,
)
from textcore.pipeline.prompts import load_stage_prompt


def run(
    *,
    chunks: list[dict[str, Any]],
    paragraphs: list[dict[str, Any]],
    llm_client: LLMClient,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    system = load_stage_prompt(
        "s4_clean.system.md",
        rules=(
            "colloquial_cleaning.md",
            "classics_protection.md",
            "essay_feedback.md",
        ),
    )
    schema = def_schema("chunkResult")
    results: list[dict[str, Any]] = []
    calls: list[dict[str, Any]] = []

    for chunk in chunks:
        user = _build_user(chunk, paragraphs)
        obj, result = llm_client.complete_json(system, user, schema, stage="S4")
        validate_subschema(obj, "chunkResult")
        if obj["chunk_id"] != chunk["chunk_id"]:
            raise ValueError(f"S4 returned chunk_id {obj['chunk_id']} for {chunk['chunk_id']}")
        results.append(obj)
        calls.append(model_call("S4", result))
    return results, calls


def _build_user(chunk: dict[str, Any], paragraphs: list[dict[str, Any]]) -> str:
    payload = {
        "chunk_id": chunk["chunk_id"],
        "paragraph_range": chunk["paragraph_range"],
        "primary_type": chunk.get("primary_type"),
        "context_before": chunk.get("context_before", ""),
        "current_chunk_original": paragraph_text_for_chunk(chunk, paragraphs),
        "must_preserve_spans": chunk.get("must_preserve_spans", []),
    }
    preserve = protected_spans(chunk.get("must_preserve_spans", []))
    return (
        "Process this chunk. Return only the JSON object.\n\n"
        f"{dump_payload(payload)}\n\n"
        f"Protected spans:\n{preserve}"
    )
