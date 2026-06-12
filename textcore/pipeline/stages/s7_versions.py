"""S7 四档版本生成（逐块拼装版）。

修复"单次输出少给"导致各档过度压缩：
- faithful：拼装 S4 各块 cleaned_text（不调 LLM）。保留率 = S4 之和。
- concise：逐块 LLM 润色 deterministic coverage scaffold，低于比例门则回退 scaffold。
- study：拼装 deterministic study scaffold（不调 LLM）。
- outline：拼装 deterministic outline scaffold，可合并更丰富的 S6 outline_tree 标题（不调 LLM）。
- char_count / compression：代码从 body_md 真实计算，clamp ≤ 1。
"""

from __future__ import annotations

import re
from typing import Any

from textcore.contracts.course_state import validate_subschema
from textcore.llm import LLMClient
from textcore.pipeline.deterministic.quality_gates import check_version_ratio
from textcore.pipeline.deterministic.version_scaffold import (
    build_chunk_scaffolds,
    text_char_count,
)
from textcore.pipeline.llm_stage import def_schema, dump_payload, model_call
from textcore.pipeline.prompts import load_stage_prompt

CONCISE_MIN_RATIO = 0.25
CONCISE_HARD_RATIO = (0.22, 0.45)


def _text_len(s: str) -> int:
    return text_char_count(s)


def _version(body_md: str, source_chars: int) -> dict[str, Any]:
    chars = _text_len(body_md)
    compression = round(chars / source_chars, 2) if source_chars else 0.0
    return {"body_md": body_md, "char_count": chars, "compression": min(compression, 1.0)}


def _chunk_title(cr: dict[str, Any]) -> str:
    points = cr.get("key_points") or []
    return points[0] if points else f"片段 {cr.get('chunk_id', '')}"


def assemble_faithful(chunk_results: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    for cr in chunk_results:
        text = (cr.get("cleaned_text") or "").strip()
        if text:
            parts.append(f"## {_chunk_title(cr)}\n\n{text}")
    return "\n\n".join(parts)


def build_scaffolds(
    chunk_results: list[dict[str, Any]],
    course_types: dict[str, Any],
) -> list[dict[str, dict[str, Any]]]:
    scaffolds: list[dict[str, dict[str, Any]]] = []
    for cr in chunk_results:
        cleaned_text = str(cr.get("cleaned_text") or "")
        original_text = _chunk_original_text(cr) or cleaned_text
        scaffolds.append(
            build_chunk_scaffolds(
                chunk_id=str(cr.get("chunk_id") or ""),
                title=str(cr.get("title") or _chunk_title(cr)),
                original_text=original_text,
                cleaned_text=cleaned_text,
                course_types=course_types,
                preserve_spans=_chunk_preserve_spans(cr),
            )
        )
    return scaffolds


def assemble_study(chunk_scaffolds: list[dict[str, dict[str, Any]]]) -> str:
    """学习整理版 = 各块 deterministic study scaffold。"""
    return _assemble_scaffold_version(chunk_scaffolds, "study")


def render_outline(
    chunk_scaffolds: list[dict[str, dict[str, Any]]],
    outline_tree: list[dict[str, Any]],
    source_char_count: int,
) -> str:
    """大纲版 = deterministic outline scaffold，可并入更丰富的 S6 标题。"""
    scaffold_md = _assemble_scaffold_version(chunk_scaffolds, "outline")
    tree_md = _render_outline_tree(outline_tree)
    if not tree_md or not _outline_tree_richer(outline_tree, scaffold_md):
        return scaffold_md

    candidate = f"{tree_md}\n\n{scaffold_md}" if scaffold_md else tree_md
    gate = check_version_ratio(
        version_key="outline",
        actual_chars=_text_len(candidate),
        source_chars=source_char_count,
    )
    return candidate if gate["ok"] else scaffold_md


def _render_outline_tree(outline_tree: list[dict[str, Any]]) -> str:
    if not outline_tree:
        return ""

    lines = ["# 课程提纲", ""]

    def walk(nodes: list[dict[str, Any]], depth: int) -> None:
        for node in nodes:
            title = str(node.get("title") or "").strip()
            if title:
                lines.append(f"{'  ' * depth}- {title}")
            if node.get("children"):
                walk(node["children"], depth + 1)

    walk(outline_tree, 0)
    return "\n".join(lines)


def _assemble_scaffold_version(
    chunk_scaffolds: list[dict[str, dict[str, Any]]],
    version_key: str,
) -> str:
    parts = [
        str(scaffold.get(version_key, {}).get("body_md") or "").strip()
        for scaffold in chunk_scaffolds
    ]
    return "\n\n".join(part for part in parts if part)


def _chunk_original_text(cr: dict[str, Any]) -> str:
    for key in (
        "original_text",
        "current_chunk_original",
        "chunk_original",
        "source_text",
        "raw_text",
    ):
        value = cr.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return str(cr.get("cleaned_text") or "")


def _chunk_preserve_spans(cr: dict[str, Any]) -> list[Any]:
    spans = cr.get("must_preserve_spans") or cr.get("preserve_spans") or []
    return list(spans) if isinstance(spans, list | tuple) else []


def _concise_gate(body_md: str, cleaned_text: str) -> dict[str, Any]:
    # S7 only has S4 output in this scope, so the per-chunk gate uses
    # visible chars in cleaned_text as the ratio denominator.
    return check_version_ratio(
        version_key="concise",
        actual_chars=_text_len(body_md),
        source_chars=_text_len(cleaned_text),
        hard=CONCISE_HARD_RATIO,
    )


def _hard_min_chars(cleaned_text: str) -> int:
    return int(_text_len(cleaned_text) * CONCISE_MIN_RATIO)


def _should_fallback_concise(body_md: str, cleaned_text: str, hard_min_chars: int) -> bool:
    gate = _concise_gate(body_md, cleaned_text)
    # The fallback protects against under-coverage; over-long chunk notes are kept.
    return _text_len(body_md) < hard_min_chars or (
        not gate["ok"] and float(gate["ratio"]) < CONCISE_HARD_RATIO[0]
    )


def _outline_tree_richer(outline_tree: list[dict[str, Any]], scaffold_md: str) -> bool:
    titles = _outline_titles(outline_tree)
    if not titles:
        return False
    scaffold_sections = len(re.findall(r"^##\s+", scaffold_md, flags=re.MULTILINE))
    return len(titles) > scaffold_sections or _text_len("\n".join(titles)) > _text_len(scaffold_md)


def _outline_titles(nodes: list[dict[str, Any]]) -> list[str]:
    titles: list[str] = []
    for node in nodes:
        title = str(node.get("title") or "").strip()
        if title:
            titles.append(title)
        children = node.get("children") or []
        if isinstance(children, list):
            titles.extend(_outline_titles(children))
    return titles


def run(
    *,
    chunk_results: list[dict[str, Any]],
    classics_refs: list[dict[str, Any]],
    global_result: dict[str, Any],
    source: dict[str, Any],
    course_types: dict[str, Any],
    source_char_count: int,
    llm_client: LLMClient,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    calls: list[dict[str, Any]] = []
    schema = def_schema("version")

    refs_by_chunk: dict[str, list[dict[str, Any]]] = {}
    for ref in classics_refs:
        refs_by_chunk.setdefault(ref.get("chunk_id", ""), []).append(ref)

    chunk_scaffolds = build_scaffolds(chunk_results, course_types)

    # concise：逐块生成再拼装
    concise_sys = load_stage_prompt(
        "s7_concise.system.md", rules=("classics_protection.md", "essay_feedback.md")
    )
    concise_parts: list[str] = []
    for cr, scaffold in zip(chunk_results, chunk_scaffolds, strict=False):
        cleaned_text = str(cr.get("cleaned_text") or "")
        if not cleaned_text.strip():
            continue
        coverage_scaffold = str(scaffold["concise"]["body_md"])
        hard_min_chars = _hard_min_chars(cleaned_text)
        user = dump_payload(
            {
                "chunk_clean": cleaned_text,
                "coverage_scaffold": coverage_scaffold,
                "hard_min_chars": hard_min_chars,
                "key_points": cr.get("key_points", []),
                "classics_refs": refs_by_chunk.get(cr.get("chunk_id", ""), []),
            }
        )
        obj, result = llm_client.complete_json(concise_sys, user, schema, stage="S7")
        calls.append(model_call("S7", result))
        body = (obj.get("body_md") or "").strip()
        if body:
            concise_parts.append(
                coverage_scaffold
                if _should_fallback_concise(body, cleaned_text, hard_min_chars)
                else body
            )
    concise_md = "\n\n".join(concise_parts)

    faithful_md = assemble_faithful(chunk_results)
    study_md = assemble_study(chunk_scaffolds)
    outline_md = render_outline(
        chunk_scaffolds,
        global_result.get("outline_tree", []),
        source_char_count,
    )

    versions = {
        "faithful": _version(faithful_md, source_char_count),
        "concise": _version(concise_md, source_char_count),
        "study": _version(study_md, source_char_count),
        "outline": _version(outline_md, source_char_count),
    }
    for key in versions:
        validate_subschema(versions[key], "version")
    return versions, calls
