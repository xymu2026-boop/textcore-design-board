"""S4 chunk-level faithful cleaning."""

from __future__ import annotations

from typing import Any

from textcore.contracts.course_state import validate_subschema
from textcore.llm import LLMClient
from textcore.pipeline.deterministic.quality_gates import check_version_ratio
from textcore.pipeline.deterministic.version_scaffold import (
    build_chunk_scaffolds,
    text_char_count,
)
from textcore.pipeline.llm_stage import (
    def_schema,
    dump_payload,
    model_call,
    paragraph_text_for_chunk,
    protected_spans,
)
from textcore.pipeline.prompts import load_stage_prompt

FAITHFUL_PREFERRED_RATIO = (0.85, 0.93)
FAITHFUL_HARD_RATIO = (0.70, 0.95)


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
        original_text = paragraph_text_for_chunk(chunk, paragraphs)
        original_chars = text_char_count(original_text)
        user = _build_user(chunk, paragraphs)
        obj, result = _complete_chunk(
            llm_client=llm_client,
            system=system,
            user=user,
            schema=schema,
            chunk=chunk,
        )
        calls.append(model_call("S4", result))

        gate = _faithful_ratio(obj.get("cleaned_text", ""), original_chars)
        if _below_faithful_floor(gate):
            retry_user = (
                f"{user}\n\n"
                f"你上次输出过度摘要（只剩 {gate['ratio']:.0%}）。"
                "保真清洗不是摘要，请逐句保留老师讲解，保留原文 70%-90%。"
            )
            obj, result = _complete_chunk(
                llm_client=llm_client,
                system=system,
                user=retry_user,
                schema=schema,
                chunk=chunk,
            )
            calls.append(model_call("S4", result))
            gate = _faithful_ratio(obj.get("cleaned_text", ""), original_chars)
            if _below_faithful_floor(gate):
                obj = _with_fallback_cleaned_text(
                    obj,
                    chunk=chunk,
                    original_text=original_text,
                )
                validate_subschema(obj, "chunkResult")

        results.append(obj)
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


def _complete_chunk(
    *,
    llm_client: LLMClient,
    system: str,
    user: str,
    schema: dict[str, Any],
    chunk: dict[str, Any],
) -> tuple[dict[str, Any], Any]:
    obj, result = llm_client.complete_json(system, user, schema, stage="S4")
    validate_subschema(obj, "chunkResult")
    if obj["chunk_id"] != chunk["chunk_id"]:
        raise ValueError(f"S4 returned chunk_id {obj['chunk_id']} for {chunk['chunk_id']}")
    return obj, result


def _faithful_ratio(cleaned_text: str, original_chars: int) -> dict[str, Any]:
    return check_version_ratio(
        version_key="faithful",
        actual_chars=text_char_count(cleaned_text),
        source_chars=original_chars,
        preferred=FAITHFUL_PREFERRED_RATIO,
        hard=FAITHFUL_HARD_RATIO,
    )


def _below_faithful_floor(gate: dict[str, Any]) -> bool:
    return float(gate.get("ratio", 0.0)) < FAITHFUL_HARD_RATIO[0]


def _with_fallback_cleaned_text(
    obj: dict[str, Any],
    *,
    chunk: dict[str, Any],
    original_text: str,
) -> dict[str, Any]:
    scaffolds = build_chunk_scaffolds(
        chunk_id=chunk["chunk_id"],
        title=str(chunk.get("title") or ""),
        original_text=original_text,
        preserve_spans=chunk.get("must_preserve_spans", []),
    )
    fallback = dict(obj)
    fallback["cleaned_text"] = scaffolds["faithful"]["body_md"]
    review_flags = list(fallback.get("review_flags") or [])
    review_flags.append(
        {
            "flag_id": f"pipeline_fallback_{chunk['chunk_id']}",
            "chunk_id": chunk["chunk_id"],
            "text": "保真清洗兜底",
            "reason": "S4 LLM 输出低于保真比例(<70%)，已回退确定性保真清洗",
            "category": "other",
            "severity": "medium",
            "status": "open",
        }
    )
    fallback["review_flags"] = review_flags
    return fallback
