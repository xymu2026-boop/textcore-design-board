"""S8 knowledge card and writing material extraction."""

from __future__ import annotations

from typing import Any

from textcore.contracts.course_state import validate_subschema
from textcore.llm import LLMClient
from textcore.pipeline.llm_stage import dump_payload, model_call, object_array_schema
from textcore.pipeline.prompts import load_stage_prompt


def run(
    *,
    chunk_results: list[dict[str, Any]],
    classics_refs: list[dict[str, Any]],
    global_result: dict[str, Any],
    versions: dict[str, Any],
    llm_client: LLMClient,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    payload = {
        "global": global_result,
        "chunk_results": chunk_results,
        "classics_refs": classics_refs,
        "concise_version": versions.get("concise", {}),
    }
    cards, card_calls = _extract_cards(payload, llm_client)
    materials, material_calls = _extract_materials(payload, llm_client)
    return cards, materials, card_calls + material_calls


def _extract_cards(
    payload: dict[str, Any],
    llm_client: LLMClient,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    system = load_stage_prompt("s8_cards.system.md")
    schema = object_array_schema("knowledge_cards", "knowledgeCard")
    obj, result = llm_client.complete_json(system, dump_payload(payload), schema, stage="S8")
    cards = obj["knowledge_cards"]
    for card in cards:
        validate_subschema(card, "knowledgeCard")
    return cards, [model_call("S8", result)]


def _extract_materials(
    payload: dict[str, Any],
    llm_client: LLMClient,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    system = load_stage_prompt("s8_materials.system.md", rules=("essay_feedback.md",))
    schema = object_array_schema("writing_materials", "writingMaterial")
    obj, result = llm_client.complete_json(system, dump_payload(payload), schema, stage="S8")
    materials = obj["writing_materials"]
    for material in materials:
        validate_subschema(material, "writingMaterial")
    return materials, [model_call("S8", result)]
