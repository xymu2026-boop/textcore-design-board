"""S4 chunk-level faithful cleaning and metadata extraction."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from textcore.contracts.course_state import validate_subschema
from textcore.llm import LLMClient
from textcore.pipeline.deterministic.transcript_cleaner import clean_transcript_text
from textcore.pipeline.llm_stage import (
    def_schema,
    dump_payload,
    model_call,
    paragraph_text_for_chunk,
    protected_spans,
)
from textcore.pipeline.prompts import load_stage_prompt

S4_METADATA_MODEL = "deepseek-v4-flash"
METADATA_FIELDS = (
    "key_points",
    "student_answer_kept",
    "entities",
    "classics_candidates",
    "review_flags",
)
VALID_REVIEW_FLAG_CATEGORIES = {
    "transcription_error",
    "uncertain_person",
    "uncertain_title",
    "classical_typo",
    "unclear_reading",
    "other",
}
VALID_REVIEW_FLAG_SEVERITIES = {"low", "medium", "high"}
VALID_REVIEW_FLAG_STATUSES = {"open", "resolved", "dismissed"}


def run(
    *,
    chunks: list[dict[str, Any]],
    paragraphs: list[dict[str, Any]],
    llm_client: LLMClient,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    system = load_stage_prompt(
        "s4_extract.system.md",
        rules=(
            "classics_protection.md",
            "essay_feedback.md",
        ),
    )
    schema = _metadata_schema()
    results: list[dict[str, Any]] = []
    calls: list[dict[str, Any]] = []

    for chunk in chunks:
        original_text = paragraph_text_for_chunk(chunk, paragraphs)
        deterministic = clean_transcript_text(
            original_text,
            preserve_spans=chunk.get("must_preserve_spans", ()),
        )
        cleaned_text = str(deterministic.get("text") or "").strip()
        if not cleaned_text:
            raise ValueError(f"S4 deterministic cleaned_text is empty for {chunk['chunk_id']}")

        user = _build_user(chunk, cleaned_text)
        metadata, result = _complete_metadata(
            llm_client=llm_client,
            system=system,
            user=user,
            schema=schema,
        )
        calls.append(model_call("S4", result))
        results.append(
            _assemble_chunk_result(
                chunk=chunk,
                cleaned_text=cleaned_text,
                metadata=metadata,
                deterministic_review_flags=deterministic.get("review_flags", []),
            )
        )
    return results, calls


def _metadata_schema() -> dict[str, Any]:
    chunk_schema = def_schema("chunkResult")
    properties = deepcopy(chunk_schema["properties"])
    properties["entities"]["required"] = ["persons", "works", "concepts"]
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "additionalProperties": False,
        "required": list(METADATA_FIELDS),
        "properties": {field: properties[field] for field in METADATA_FIELDS},
        "$defs": chunk_schema["$defs"],
    }


def _build_user(chunk: dict[str, Any], cleaned_text: str) -> str:
    payload = {
        "chunk_id": chunk["chunk_id"],
        "paragraph_range": chunk["paragraph_range"],
        "primary_type": chunk.get("primary_type"),
        "context_before": chunk.get("context_before", ""),
        "current_chunk_cleaned": cleaned_text,
        "must_preserve_spans": chunk.get("must_preserve_spans", []),
    }
    preserve = protected_spans(chunk.get("must_preserve_spans", []))
    return (
        "Extract compact metadata from this already-cleaned chunk. "
        "Return only the JSON object and do not include cleaned_text.\n\n"
        f"{dump_payload(payload)}\n\n"
        f"Protected spans:\n{preserve}"
    )


def _complete_metadata(
    *,
    llm_client: LLMClient,
    system: str,
    user: str,
    schema: dict[str, Any],
) -> tuple[dict[str, Any], Any]:
    return llm_client.complete_json(
        system,
        user,
        schema,
        stage="S4",
        model=S4_METADATA_MODEL,
    )


def _assemble_chunk_result(
    *,
    chunk: dict[str, Any],
    cleaned_text: str,
    metadata: dict[str, Any],
    deterministic_review_flags: Any,
) -> dict[str, Any]:
    chunk_id = chunk["chunk_id"]
    result = {
        "chunk_id": chunk_id,
        "cleaned_text": cleaned_text,
        "key_points": list(metadata.get("key_points") or []),
        "student_answer_kept": list(metadata.get("student_answer_kept") or []),
        "entities": _entities(metadata.get("entities")),
        "classics_candidates": list(metadata.get("classics_candidates") or []),
        "review_flags": _merge_review_flags(
            deterministic_review_flags,
            metadata.get("review_flags", []),
            chunk_id=chunk_id,
        ),
    }
    validate_subschema(result, "chunkResult")
    return result


def _entities(value: Any) -> dict[str, list[str]]:
    if not isinstance(value, dict):
        return {"persons": [], "works": [], "concepts": []}
    return {
        "persons": list(value.get("persons") or []),
        "works": list(value.get("works") or []),
        "concepts": list(value.get("concepts") or []),
    }


def _merge_review_flags(
    deterministic_flags: Any,
    llm_flags: Any,
    *,
    chunk_id: str,
) -> list[dict[str, Any]]:
    combined = _normalize_review_flags(
        deterministic_flags,
        chunk_id=chunk_id,
        source="deterministic",
    ) + _normalize_review_flags(
        llm_flags,
        chunk_id=chunk_id,
        source="llm",
    )
    seen: set[tuple[Any, ...]] = set()
    deduped: list[dict[str, Any]] = []
    for flag in combined:
        key = (
            flag.get("chunk_id"),
            flag.get("text"),
            flag.get("suggestion"),
            flag.get("reason"),
            flag.get("category"),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(flag)
    return deduped


def _normalize_review_flags(
    flags: Any,
    *,
    chunk_id: str,
    source: str,
) -> list[dict[str, Any]]:
    if not isinstance(flags, list):
        return []

    normalized: list[dict[str, Any]] = []
    for index, flag in enumerate(flags, start=1):
        if not isinstance(flag, dict):
            continue
        text = str(flag.get("text") or "").strip()
        reason = str(flag.get("reason") or "").strip()
        if not text or not reason:
            continue

        out = {key: value for key, value in flag.items() if value not in ("", None)}
        out["text"] = text
        out["reason"] = reason
        out.setdefault("flag_id", f"s4_{source}_{chunk_id}_{index:03d}")
        out.setdefault("chunk_id", chunk_id)

        if out.get("category") not in VALID_REVIEW_FLAG_CATEGORIES:
            out["category"] = (
                "transcription_error" if source == "deterministic" else "other"
            )
        if out.get("severity") not in VALID_REVIEW_FLAG_SEVERITIES:
            out["severity"] = "low" if source == "deterministic" else "medium"
        if out.get("status") not in VALID_REVIEW_FLAG_STATUSES:
            out["status"] = "open"

        validate_subschema(out, "reviewFlag")
        normalized.append(out)
    return normalized
