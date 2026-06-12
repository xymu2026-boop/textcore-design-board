from __future__ import annotations

from typing import Any

from textcore.pipeline.stages.s9_quality import run

SOURCE_CHARS = 1000
PREFERRED_COUNTS = {
    "faithful": 900,
    "concise": 310,
    "study": 90,
    "outline": 50,
}


def test_s9_aggregates_flags_quality_and_classics_diff() -> None:
    review_flags, quality = run(
        chunk_results=[
            {
                "chunk_id": "c001",
                "source_text": "源" * SOURCE_CHARS,
                "review_flags": [
                    {
                        "text": "人名疑点",
                        "reason": "可能是转写错误",
                        "category": "uncertain_person",
                        "severity": "high",
                    },
                    {
                        "text": "人名疑点",
                        "reason": "可能是转写错误",
                        "category": "uncertain_person",
                        "severity": "high",
                    },
                ],
            }
        ],
        global_result={
            "outline_tree": [
                {"title": "一", "level": 2, "children": [{"title": "1", "level": 3}]}
            ],
            "merged_review_flags": [
                {
                    "text": "全局疑点",
                    "reason": "跨块合并需复核",
                    "category": "other",
                    "severity": "medium",
                }
            ],
        },
        classics_refs=[
            {
                "ref_id": "ref_001",
                "chunk_id": "c001",
                "matched": True,
                "title": "关雎",
                "canonical_text": "关关雎鸠",
                "diffs": [{"pid": "p001", "raw": "鸠鸠", "canonical": "雎鸠"}],
            }
        ],
        versions=_versions(PREFERRED_COUNTS),
    )

    assert [flag["flag_id"] for flag in review_flags] == ["rf_001", "rf_002", "rf_003"]
    assert review_flags[-1]["category"] == "classical_typo"
    assert quality["coverage"] == "good"
    assert quality["recommended_human_review"] is True
    assert any("古文原文差异" in risk for risk in quality["main_risks"])


def test_s9_records_coverage_and_classics_risks_without_review_flags() -> None:
    review_flags, quality = run(
        chunk_results=[_source_chunk()],
        global_result={"outline_tree": []},
        classics_refs=[
            {
                "ref_id": "ref_001",
                "chunk_id": "c001",
                "matched": True,
                "title": "空文本",
                "canonical_text": "",
            }
        ],
        versions=_versions(PREFERRED_COUNTS, empty_body_keys={"study"}),
    )

    assert review_flags == []
    assert quality["coverage"] == "poor"
    assert quality["recommended_human_review"] is False
    assert any("study 版本正文为空" in risk for risk in quality["main_risks"])
    assert not any(risk.startswith("[risk]") for risk in quality["main_risks"])
    assert any("canonical_text 为空" in risk for risk in quality["main_risks"])


def test_s9_preferred_version_ratios_do_not_report_ratio_findings() -> None:
    _review_flags, quality = _run_with_counts(PREFERRED_COUNTS)

    assert quality["recommended_human_review"] is False
    assert not any(
        risk.startswith("[warning]") or risk.startswith("[risk]")
        for risk in quality["main_risks"]
    )


def test_s9_hard_in_range_preferred_deviation_reports_warning_only() -> None:
    _review_flags, quality = _run_with_counts(
        {**PREFERRED_COUNTS, "concise": 230},
    )

    assert quality["recommended_human_review"] is False
    assert any(
        risk
        == "[warning] 精简整理版占比 23%，低于理想区间(28-38%)但在可接受范围"
        for risk in quality["main_risks"]
    )
    assert not any(risk.startswith("[risk]") for risk in quality["main_risks"])


def test_s9_hard_out_of_range_reports_risk_and_human_review() -> None:
    _review_flags, quality = _run_with_counts(
        {**PREFERRED_COUNTS, "faithful": 500},
    )

    assert quality["recommended_human_review"] is True
    assert any(
        risk == "[risk] 保真清洗版占比 50%，低于硬底线(70-95%)，建议人工复核"
        for risk in quality["main_risks"]
    )


def _run_with_counts(counts: dict[str, int]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    return run(
        chunk_results=[_source_chunk()],
        global_result=_hierarchical_global(),
        classics_refs=[],
        versions=_versions(counts),
    )


def _source_chunk() -> dict[str, Any]:
    return {"chunk_id": "c001", "source_text": "源" * SOURCE_CHARS, "review_flags": []}


def _hierarchical_global() -> dict[str, Any]:
    return {"outline_tree": [{"title": "一", "level": 2, "children": [{"title": "1"}]}]}


def _versions(
    counts: dict[str, int],
    *,
    empty_body_keys: set[str] | None = None,
) -> dict[str, dict[str, Any]]:
    empty_body_keys = empty_body_keys or set()
    bodies = {
        "faithful": "## 保真清洗\n正文",
        "concise": "## 精简整理\n正文",
        "study": "- 要点",
        "outline": "## 一\n### 1",
    }
    return {
        key: {
            "body_md": "" if key in empty_body_keys else bodies[key],
            "char_count": count,
            "compression": round(count / SOURCE_CHARS, 2),
        }
        for key, count in counts.items()
    }
