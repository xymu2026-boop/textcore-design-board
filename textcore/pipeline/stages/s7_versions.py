"""S7 四档版本生成（逐块拼装版）。

修复"单次输出少给"导致各档过度压缩：
- faithful：拼装 S4 各块 cleaned_text（不调 LLM）。保留率 = S4 之和。
- concise：**逐块** LLM 调用（每块约 30-40%），再拼装。避免整篇一次输出少给。
- study：由 S4 各块 key_points 代码拼装（不调 LLM）。
- outline：由各块标题 + S6 outline_tree 代码渲染（不调 LLM）。
- char_count / compression：代码从 body_md 真实计算，clamp ≤ 1。
"""

from __future__ import annotations

import re
from typing import Any

from textcore.contracts.course_state import validate_subschema
from textcore.llm import LLMClient
from textcore.pipeline.llm_stage import def_schema, dump_payload, model_call
from textcore.pipeline.prompts import load_stage_prompt


def _text_len(s: str) -> int:
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"[#>*`\-\[\]()|]+", "", s)
    return len(re.sub(r"\s+", "", s))


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


def assemble_study(chunk_results: list[dict[str, Any]]) -> str:
    """学习整理版 = 各块标题 + 要点列表（来自 S4 key_points）。"""
    parts: list[str] = []
    for cr in chunk_results:
        points = cr.get("key_points") or []
        if not points:
            continue
        lines = [f"## {_chunk_title(cr)}"]
        lines += [f"- {p}" for p in points]
        parts.append("\n".join(lines))
    return "\n\n".join(parts)


def render_outline(chunk_results: list[dict[str, Any]], outline_tree: list[dict[str, Any]]) -> str:
    """优先用 S6 大纲；若过于稀疏，回退为各块标题 + 首要点。"""
    lines = ["# 课程提纲", ""]

    def walk(nodes: list[dict[str, Any]], depth: int) -> None:
        for node in nodes:
            lines.append(f"{'  ' * depth}- {node.get('title', '')}")
            if node.get("children"):
                walk(node["children"], depth + 1)

    if outline_tree and len("".join(n.get("title", "") for n in outline_tree)) > 30:
        walk(outline_tree, 0)
    else:
        for i, cr in enumerate(chunk_results, 1):
            lines.append(f"- {i}. {_chunk_title(cr)}")
            for p in (cr.get("key_points") or [])[1:3]:
                lines.append(f"  - {p}")
    return "\n".join(lines)


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

    # concise：逐块生成再拼装
    concise_sys = load_stage_prompt(
        "s7_concise.system.md", rules=("classics_protection.md", "essay_feedback.md")
    )
    concise_parts: list[str] = []
    for cr in chunk_results:
        if not (cr.get("cleaned_text") or "").strip():
            continue
        user = dump_payload(
            {
                "chunk_clean": cr.get("cleaned_text", ""),
                "key_points": cr.get("key_points", []),
                "classics_refs": refs_by_chunk.get(cr.get("chunk_id", ""), []),
            }
        )
        obj, result = llm_client.complete_json(concise_sys, user, schema, stage="S7")
        calls.append(model_call("S7", result))
        body = (obj.get("body_md") or "").strip()
        if body:
            concise_parts.append(body)
    concise_md = "\n\n".join(concise_parts)

    faithful_md = assemble_faithful(chunk_results)
    study_md = assemble_study(chunk_results)
    outline_md = render_outline(chunk_results, global_result.get("outline_tree", []))

    versions = {
        "faithful": _version(faithful_md, source_char_count),
        "concise": _version(concise_md, source_char_count),
        "study": _version(study_md, source_char_count),
        "outline": _version(outline_md, source_char_count),
    }
    for key in versions:
        validate_subschema(versions[key], "version")
    return versions, calls
