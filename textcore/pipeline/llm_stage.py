"""Shared helpers for LLM-backed pipeline stages."""

from __future__ import annotations

import json
from collections.abc import Iterable
from typing import Any

from textcore.contracts.course_state import load_schema
from textcore.llm import LLMResult


def def_schema(def_name: str) -> dict[str, Any]:
    schema = load_schema()
    return {**schema["$defs"][def_name], "$defs": schema["$defs"]}


def property_schema(property_name: str) -> dict[str, Any]:
    schema = load_schema()
    return {**schema["properties"][property_name], "$defs": schema["$defs"]}


def object_array_schema(property_name: str, def_name: str) -> dict[str, Any]:
    schema = load_schema()
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "additionalProperties": False,
        "required": [property_name],
        "properties": {
            property_name: {
                "type": "array",
                "items": {"$ref": f"#/$defs/{def_name}"},
            }
        },
        "$defs": schema["$defs"],
    }


def model_call(stage: str, result: LLMResult) -> dict[str, Any]:
    return {
        "stage": stage,
        "model": result.model,
        "prompt_tokens": result.prompt_tokens,
        "completion_tokens": result.completion_tokens,
        "cost_usd": 0,
    }


def dump_payload(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2)


def paragraph_text_for_chunk(
    chunk: dict[str, Any],
    paragraphs: list[dict[str, Any]],
) -> str:
    start_pid, end_pid = chunk["paragraph_range"]
    started = False
    selected: list[dict[str, Any]] = []
    for paragraph in paragraphs:
        if paragraph["pid"] == start_pid:
            started = True
        if started:
            selected.append(paragraph)
        if paragraph["pid"] == end_pid:
            break
    return "\n".join(_format_paragraph(paragraph) for paragraph in selected)


def protected_spans(spans: Iterable[dict[str, Any]]) -> str:
    lines = []
    for span in spans:
        reason = span.get("reason", "")
        text = span.get("text", "")
        lines.append(f"reason={reason}\n<PRESERVE>{text}</PRESERVE>")
    return "\n\n".join(lines)


def _format_paragraph(paragraph: dict[str, Any]) -> str:
    speaker = paragraph.get("speaker", "")
    ts = paragraph.get("ts", "")
    prefix_parts = [paragraph["pid"]]
    if speaker:
        prefix_parts.append(str(speaker))
    if ts:
        prefix_parts.append(str(ts))
    return f"[{' | '.join(prefix_parts)}] {paragraph['text']}"
