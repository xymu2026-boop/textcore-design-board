from __future__ import annotations

from textcore.pipeline.stages.s9_quality import run


def test_s9_aggregates_flags_quality_and_classics_diff() -> None:
    review_flags, quality = run(
        chunk_results=[
            {
                "chunk_id": "c001",
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
        versions={
            "faithful": {"body_md": "## 保真", "compression": 0.72},
            "concise": {"body_md": "## 精简", "compression": 0.31},
            "study": {"body_md": "- 要点", "compression": 0.09},
            "outline": {"body_md": "## 一\n### 1", "compression": 0.05},
        },
    )

    assert [flag["flag_id"] for flag in review_flags] == ["rf_001", "rf_002", "rf_003"]
    assert review_flags[-1]["category"] == "classical_typo"
    assert quality["coverage"] == "good"
    assert quality["recommended_human_review"] is True
    assert any("古文原文差异" in risk for risk in quality["main_risks"])


def test_s9_records_compression_and_coverage_risks_without_review_flags() -> None:
    review_flags, quality = run(
        chunk_results=[],
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
        versions={
            "faithful": {"body_md": "x", "compression": 0.4},
            "concise": {"body_md": "x", "compression": 0.8},
            "study": {"body_md": "", "compression": 0.2},
            "outline": {"body_md": "- flat", "compression": 0.2},
        },
    )

    assert review_flags == []
    assert quality["coverage"] == "poor"
    assert quality["recommended_human_review"] is False
    assert any("study 版本正文为空" in risk for risk in quality["main_risks"])
    assert any("压缩率" in risk for risk in quality["main_risks"])
    assert any("canonical_text 为空" in risk for risk in quality["main_risks"])
