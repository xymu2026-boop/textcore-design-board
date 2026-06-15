"""S9 deterministic quality checks and review flag aggregation."""

from __future__ import annotations

import re
from typing import Any

from textcore.contracts.course_state import VERSION_KEYS, validate_subschema
from textcore.pipeline.deterministic.quality_gates import (
    DEFAULT_VERSION_RANGES,
    check_version_ratio,
)
from textcore.pipeline.deterministic.quality_rubric import SCORE_KEYS, score_course
from textcore.pipeline.deterministic.version_scaffold import text_char_count

VERSION_LABELS = {
    "faithful": "保真清洗版",
    "concise": "精简整理版",
    "study": "学习整理版",
    "outline": "结构提纲版",
}

SOURCE_CHAR_KEYS = ("source_char_count", "source_chars", "original_char_count", "original_chars")
SOURCE_TEXT_KEYS = (
    "original_text",
    "current_chunk_original",
    "chunk_original",
    "source_text",
    "raw_text",
)


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
        chunk_results=chunk_results,
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
    chunk_results: list[dict[str, Any]],
    review_flags: list[dict[str, Any]],
    classics_refs: list[dict[str, Any]],
    global_result: dict[str, Any],
    versions: dict[str, Any],
) -> dict[str, Any]:
    coverage_risks = _coverage_risks(versions, global_result)
    ratio_findings, has_ratio_risk = _version_ratio_findings(versions, chunk_results)
    classics_risks, has_classics_diff = _classics_risks(classics_refs)
    high_count = sum(1 for flag in review_flags if flag.get("severity") == "high")
    rubric = score_course(
        {
            "chunk_results": chunk_results,
            "classics_refs": classics_refs,
            "global": global_result,
            "versions": versions,
            "review_flags": review_flags,
        }
    )

    main_risks = _dedupe_strings(
        [_rubric_score_line(rubric)]
        + coverage_risks
        + ratio_findings
        + classics_risks
        + [flag["reason"] for flag in review_flags if flag.get("reason")]
    )[:12]
    coverage = _coverage_label(coverage_risks, versions, global_result)
    quality = {
        "quality_score": int(rubric["overall"]),
        "coverage": coverage,
        "main_risks": main_risks,
        "recommended_human_review": bool(high_count or has_classics_diff or has_ratio_risk),
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


def _version_ratio_findings(
    versions: dict[str, Any],
    chunk_results: list[dict[str, Any]],
) -> tuple[list[str], bool]:
    findings: list[str] = []
    has_risk = False
    source_chars = _source_char_count(chunk_results) or _estimate_source_chars_from_versions(
        versions
    )

    for key in VERSION_KEYS:
        version = versions.get(key, {})
        actual_chars = _version_char_count(version)
        label = VERSION_LABELS.get(key, key)
        if actual_chars <= 0:
            findings.append(f"[risk] {label}缺少有效字数，无法计算占比")
            has_risk = True
            continue
        if source_chars <= 0:
            findings.append(f"[risk] {label}缺少原文字数，无法计算占比")
            has_risk = True
            continue

        gate = check_version_ratio(
            version_key=key,
            actual_chars=actual_chars,
            source_chars=source_chars,
        )
        level = str(gate.get("level", "risk"))
        if level == "ok":
            continue

        ratio = float(gate.get("ratio", 0.0))
        ranges = DEFAULT_VERSION_RANGES[key]
        if level == "warning":
            findings.append(_warning_message(label, ratio, ranges["preferred"]))
            continue

        findings.append(_risk_message(label, ratio, ranges["hard"]))
        has_risk = True
    return findings, has_risk


def _source_char_count(chunk_results: list[dict[str, Any]]) -> int:
    total = 0
    saw_source = False
    for chunk_result in chunk_results:
        explicit = _explicit_source_chars(chunk_result)
        if explicit > 0:
            total += explicit
            saw_source = True
            continue
        source_text = _source_text(chunk_result)
        if source_text:
            total += text_char_count(source_text)
            saw_source = True
    return total if saw_source else 0


def _explicit_source_chars(chunk_result: dict[str, Any]) -> int:
    for key in SOURCE_CHAR_KEYS:
        value = chunk_result.get(key)
        if isinstance(value, int | float) and value > 0:
            return int(value)
    return 0


def _source_text(chunk_result: dict[str, Any]) -> str:
    for key in SOURCE_TEXT_KEYS:
        value = chunk_result.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return ""


def _estimate_source_chars_from_versions(versions: dict[str, Any]) -> int:
    estimates: list[float] = []
    for key in VERSION_KEYS:
        version = versions.get(key, {})
        actual_chars = _version_char_count(version)
        compression = version.get("compression")
        if (
            actual_chars > 0
            and isinstance(compression, int | float)
            and 0 < float(compression) <= 1
        ):
            estimates.append(actual_chars / float(compression))
    if not estimates:
        return 0
    estimates.sort()
    midpoint = len(estimates) // 2
    if len(estimates) % 2:
        return int(round(estimates[midpoint]))
    return int(round((estimates[midpoint - 1] + estimates[midpoint]) / 2))


def _version_char_count(version: dict[str, Any]) -> int:
    char_count = version.get("char_count")
    if isinstance(char_count, int | float) and char_count > 0:
        return int(char_count)
    return text_char_count(str(version.get("body_md", "")))


def _warning_message(label: str, ratio: float, preferred: tuple[float, float]) -> str:
    direction = "低于" if ratio < preferred[0] else "高于"
    return (
        f"[warning] {label}占比 {_format_percent(ratio)}，"
        f"{direction}理想区间({_format_range(preferred)})但在可接受范围"
    )


def _risk_message(label: str, ratio: float, hard: tuple[float, float]) -> str:
    direction = "低于" if ratio < hard[0] else "高于"
    return (
        f"[risk] {label}占比 {_format_percent(ratio)}，"
        f"{direction}硬底线({_format_range(hard)})，建议人工复核"
    )


def _format_percent(value: float) -> str:
    return f"{value:.0%}"


def _format_range(bounds: tuple[float, float]) -> str:
    return f"{bounds[0] * 100:.0f}-{bounds[1] * 100:.0f}%"


def _ratio_penalty(findings: list[str]) -> int:
    penalty = 0
    for finding in findings:
        if finding.startswith("[risk]"):
            penalty += 7
        elif finding.startswith("[warning]"):
            penalty += 3
    return penalty


def _rubric_score_line(rubric: dict[str, int]) -> str:
    details = " ".join(f"{key}={rubric[key]}" for key in SCORE_KEYS)
    return f"[score] {details} overall={rubric['overall']}"


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
