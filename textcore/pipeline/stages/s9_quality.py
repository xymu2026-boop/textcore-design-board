"""S9 deterministic quality checks and review flag aggregation."""

from __future__ import annotations

import re
from typing import Any

from textcore.contracts.course_state import VERSION_KEYS, validate_subschema

COMPRESSION_RANGES = {
    "faithful": (0.65, 0.90),
    "concise": (0.25, 0.45),
    "study": (0.05, 0.15),
    "outline": (0.03, 0.10),
}


def run(
    *,
    chunk_results: list[dict[str, Any]],
    classics_refs: list[dict[str, Any]],
    global_result: dict[str, Any],
    versions: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Return top-level review flags and deterministic quality summary."""

    review_flags = aggregate_review_flags(
        chunk_results=chunk_results,
        classics_refs=classics_refs,
        global_result=global_result,
    )
    quality = evaluate_quality(
        review_flags=review_flags,
        classics_refs=classics_refs,
        global_result=global_result,
        versions=versions,
    )
    return review_flags, quality


def aggregate_review_flags(
    *,
    chunk_results: list[dict[str, Any]],
    classics_refs: list[dict[str, Any]],
    global_result: dict[str, Any],
) -> list[dict[str, Any]]:
    flags: list[dict[str, Any]] = []
    for chunk_result in chunk_results:
        for flag in chunk_result.get("review_flags", []):
            flags.append(_with_flag_defaults(flag, chunk_result["chunk_id"], len(flags) + 1))
    for flag in global_result.get("merged_review_flags", []):
        flags.append(_with_flag_defaults(flag, flag.get("chunk_id", ""), len(flags) + 1))
    for ref in classics_refs:
        for diff in ref.get("diffs", []):
            flag = {
                "pid": diff.get("pid", ""),
                "chunk_id": ref["chunk_id"],
                "text": diff["raw"],
                "suggestion": diff["canonical"],
                "reason": "古文原文与权威文本存在差异，需人工核对",
                "category": "classical_typo",
                "severity": "medium",
                "status": "open",
            }
            flags.append(_with_flag_defaults(flag, ref["chunk_id"], len(flags) + 1))
    return _dedupe_flags(flags)


def evaluate_quality(
    *,
    review_flags: list[dict[str, Any]],
    classics_refs: list[dict[str, Any]],
    global_result: dict[str, Any],
    versions: dict[str, Any],
) -> dict[str, Any]:
    coverage_risks = _coverage_risks(versions, global_result)
    compression_risks = _compression_risks(versions)
    classics_risks, has_classics_diff = _classics_risks(classics_refs)
    high_count = sum(1 for flag in review_flags if flag.get("severity") == "high")
    medium_count = sum(1 for flag in review_flags if flag.get("severity") == "medium")
    low_count = sum(1 for flag in review_flags if flag.get("severity") == "low")

    main_risks = _dedupe_strings(
        coverage_risks
        + compression_risks
        + classics_risks
        + [flag["reason"] for flag in review_flags if flag.get("reason")]
    )[:12]
    score = 100
    score -= len(coverage_risks) * 10
    score -= len(compression_risks) * 7
    score -= len(classics_risks) * 8
    score -= high_count * 12 + medium_count * 4 + low_count * 2
    score = max(0, min(100, score))
    coverage = _coverage_label(coverage_risks, versions, global_result)
    quality = {
        "quality_score": int(score),
        "coverage": coverage,
        "main_risks": main_risks,
        "recommended_human_review": bool(high_count or has_classics_diff),
    }
    validate_subschema(quality, "quality")
    return quality


def _coverage_risks(versions: dict[str, Any], global_result: dict[str, Any]) -> list[str]:
    risks: list[str] = []
    for key in VERSION_KEYS:
        if not str(versions.get(key, {}).get("body_md", "")).strip():
            risks.append(f"{key} 版本正文为空")
    if not _outline_has_hierarchy(versions.get("outline", {}), global_result):
        risks.append("结构提纲缺少明确层级")
    return risks


def _compression_risks(versions: dict[str, Any]) -> list[str]:
    risks: list[str] = []
    for key, (lower, upper) in COMPRESSION_RANGES.items():
        compression = versions.get(key, {}).get("compression")
        if compression is None:
            risks.append(f"{key} 版本缺少压缩率")
            continue
        if not lower <= compression <= upper:
            risks.append(f"{key} 压缩率 {compression:.2f} 超出建议区间 {lower:.2f}-{upper:.2f}")
    return risks


def _classics_risks(classics_refs: list[dict[str, Any]]) -> tuple[list[str], bool]:
    risks: list[str] = []
    has_diff = False
    for ref in classics_refs:
        if not ref.get("matched"):
            continue
        label = _classics_label(ref)
        if not str(ref.get("canonical_text", "")).strip():
            risks.append(f"{label} 已命中古文库但 canonical_text 为空")
        if ref.get("diffs"):
            has_diff = True
            risks.append(f"{label} 存在古文原文差异，需人工核对")
    return risks, has_diff


def _outline_has_hierarchy(version: dict[str, Any], global_result: dict[str, Any]) -> bool:
    tree = global_result.get("outline_tree", [])
    if _tree_depth(tree) >= 2:
        return True
    body = str(version.get("body_md", ""))
    heading_levels = {
        len(match.group(1))
        for match in re.finditer(r"^(#{1,6})\s+\S+", body, flags=re.MULTILINE)
    }
    if len(heading_levels) >= 2:
        return True
    return bool(re.search(r"^\s{0,3}[-*]\s+\S+", body, flags=re.MULTILINE)) and bool(
        re.search(r"^\s{2,}[-*]\s+\S+", body, flags=re.MULTILINE)
    )


def _tree_depth(nodes: list[dict[str, Any]]) -> int:
    if not nodes:
        return 0
    return 1 + max((_tree_depth(node.get("children", [])) for node in nodes), default=0)


def _coverage_label(
    coverage_risks: list[str],
    versions: dict[str, Any],
    global_result: dict[str, Any],
) -> str:
    nonempty_versions = sum(
        1 for key in VERSION_KEYS if str(versions.get(key, {}).get("body_md", "")).strip()
    )
    if not coverage_risks and nonempty_versions == len(VERSION_KEYS):
        return "good"
    if nonempty_versions >= 3 and global_result.get("outline_tree"):
        return "fair"
    return "poor"


def _with_flag_defaults(flag: dict[str, Any], chunk_id: str, index: int) -> dict[str, Any]:
    out = dict(flag)
    out.setdefault("flag_id", f"rf_{index:03d}")
    if chunk_id:
        out.setdefault("chunk_id", chunk_id)
    out.setdefault("category", "other")
    out.setdefault("severity", "medium")
    out.setdefault("status", "open")
    cleaned = {key: value for key, value in out.items() if value != ""}
    validate_subschema(cleaned, "reviewFlag")
    return cleaned


def _dedupe_flags(flags: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[Any, ...]] = set()
    deduped: list[dict[str, Any]] = []
    for flag in flags:
        key = (
            flag.get("pid"),
            flag.get("chunk_id"),
            flag.get("text"),
            flag.get("suggestion"),
            flag.get("reason"),
        )
        if key in seen:
            continue
        seen.add(key)
        flag["flag_id"] = f"rf_{len(deduped) + 1:03d}"
        deduped.append(flag)
    return deduped


def _dedupe_strings(items: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        deduped.append(item)
    return deduped


def _classics_label(ref: dict[str, Any]) -> str:
    title = ref.get("title") or ref.get("ref_id") or ref.get("chunk_id") or "古文引用"
    writer = ref.get("writer")
    return f"《{title}》({writer})" if writer else f"《{title}》"
