from __future__ import annotations

from typing import Any

from textcore.pipeline.deterministic.quality_rubric import SCORE_KEYS, score_course
from textcore.pipeline.stages.s9_quality import run as run_s9


def test_score_course_high_quality_scores_high() -> None:
    scores = score_course(_high_quality_state())

    assert all(scores[key] >= 90 for key in SCORE_KEYS)
    assert scores["overall"] >= 90


def test_score_course_low_quality_penalizes_target_dimensions() -> None:
    scores = score_course(_low_quality_state())

    assert scores["coverage"] <= 30
    assert scores["structure"] <= 30
    assert scores["fluency"] <= 60
    assert scores["coherence"] <= 60
    assert scores["classics_safety"] <= 30
    assert scores["overall"] <= 45


def test_s9_quality_score_comes_from_rubric() -> None:
    state = _high_quality_state()
    review_flags, quality = run_s9(
        chunk_results=state["chunk_results"],
        classics_refs=state["classics_refs"],
        global_result=state["global"],
        versions=state["versions"],
    )
    expected = score_course({**state, "review_flags": review_flags})

    assert quality["quality_score"] == expected["overall"]
    assert quality["main_risks"][0] == _score_line(expected)


def _high_quality_state() -> dict[str, Any]:
    canonical = "床前明月光，疑是地上霜。"
    return {
        "chunks": [{"chunk_id": "c001"}, {"chunk_id": "c002"}],
        "chunk_results": [
            {
                "chunk_id": "c001",
                "source_text": "源" * 500,
                "cleaned_text": (
                    "首先，现代文阅读的核心方法是明确题型。因此要回归文本，分析表达效果。"
                    "李白《静夜思》中的名句要原样保留。"
                ),
                "key_points": ["现代文阅读核心方法：明确题型和回归文本。"],
                "entities": {
                    "persons": ["李白"],
                    "works": ["《静夜思》"],
                    "concepts": ["现代文阅读", "表达效果"],
                },
                "review_flags": [],
            },
            {
                "chunk_id": "c002",
                "source_text": "源" * 500,
                "cleaned_text": "其次，作文选材要围绕立意，所以结构要清楚。",
                "key_points": ["作文选材围绕立意，结构服务中心。"],
                "entities": {
                    "persons": [],
                    "works": [],
                    "concepts": ["作文", "立意", "结构"],
                },
                "review_flags": [],
            },
        ],
        "classics_refs": [
            {
                "ref_id": "ref_001",
                "chunk_id": "c001",
                "matched": True,
                "title": "静夜思",
                "writer": "李白",
                "canonical_text": canonical,
                "diffs": [{"pid": "p001", "raw": "地上雪", "canonical": "地上霜"}],
            }
        ],
        "global": {
            "outline_tree": [
                {"title": "阅读方法", "level": 2, "children": [{"title": "题型", "level": 3}]}
            ],
            "merged_review_flags": [],
        },
        "versions": {
            "faithful": {
                "body_md": (
                    "## c001 现代文阅读\n\n"
                    f"首先，现代文阅读的核心方法是明确题型。因此要回归文本，分析表达效果。"
                    f"李白《静夜思》原文：{canonical}\n\n"
                    "## c002 作文选材\n\n"
                    "其次，作文选材要围绕立意，所以结构要清楚。"
                ),
                "char_count": 900,
                "compression": 0.9,
            },
            "concise": {
                "body_md": (
                    "## c001 现代文阅读\n\n"
                    f"首先，现代文阅读要明确题型，因此回归文本分析表达效果。"
                    f"李白《静夜思》保留原文：{canonical}\n\n"
                    "## c002 作文选材\n\n"
                    "其次，作文选材围绕立意，所以结构服务中心。"
                ),
                "char_count": 320,
                "compression": 0.32,
            },
            "study": {
                "body_md": (
                    "## c001 阅读方法\n\n"
                    f"- 现代文阅读：明确题型，分析表达效果，记住李白《静夜思》：{canonical}\n\n"
                    "## c002 作文结构\n\n"
                    "- 作文：选材扣住立意，结构服务中心。"
                ),
                "char_count": 90,
                "compression": 0.09,
            },
            "outline": {
                "body_md": (
                    "# 课程提纲\n\n"
                    "## c001 现代文阅读\n\n"
                    "### 题型与表达效果\n\n"
                    "## c002 作文选材\n\n"
                    "### 立意与结构"
                ),
                "char_count": 50,
                "compression": 0.05,
            },
        },
        "review_flags": [
            {
                "flag_id": "rf_001",
                "pid": "p001",
                "chunk_id": "c001",
                "text": "地上雪",
                "suggestion": "地上霜",
                "reason": "古文原文差异，需人工核对",
                "category": "classical_typo",
                "severity": "medium",
                "status": "open",
            }
        ],
    }


def _low_quality_state() -> dict[str, Any]:
    chunk_results = []
    for index in range(1, 5):
        chunk_results.append(
            {
                "chunk_id": f"c{index:03d}",
                "cleaned_text": "首先，作文结构要围绕立意，现代文阅读要分析表达效果。",
                "key_points": [f"第{index}块：作文结构与阅读方法。"],
                "entities": {
                    "persons": ["李白"],
                    "works": ["《静夜思》"],
                    "concepts": ["作文", "立意", "表达效果"],
                },
                "review_flags": [],
            }
        )
    return {
        "chunks": [
            {
                "chunk_id": "c001",
                # 原句未在保真版原样保留(被改坏) → preserve_score 低
                "must_preserve_spans": [
                    {"text": "床前明月光，疑是地上霜。", "reason": "poetry"}
                ],
            },
            *({"chunk_id": f"c{index:03d}"} for index in range(2, 5)),
        ],
        "chunk_results": chunk_results,
        "classics_refs": [
            {
                "ref_id": "ref_001",
                "chunk_id": "c001",
                "matched": True,
                "title": "静夜思",
                "canonical_text": "床前明月光，疑是地上霜。",
                "diffs": [{"pid": "p001", "raw": "地上雪", "canonical": "地上霜"}],
            }
        ],
        "global": {"outline_tree": [], "merged_review_flags": []},
        "versions": {
            "faithful": {
                "body_md": "作文结构、立意、现代文阅读、表达效果，李白《静夜思》。",
                "char_count": 900,
                "compression": 0.9,
            },
            "concise": {
                "body_md": "这个这个嗯嗯那个是不是对吧能理解吧？？？？",
                "char_count": 320,
                "compression": 0.32,
            },
            "study": {
                "body_md": "这个那个嗯嗯嗯对吧是不是能理解吧！！！",
                "char_count": 90,
                "compression": 0.09,
            },
            "outline": {
                "body_md": "没有层级的一句话",
                "char_count": 50,
                "compression": 0.05,
            },
        },
        "review_flags": [],
    }


def _score_line(scores: dict[str, int]) -> str:
    details = " ".join(f"{key}={scores[key]}" for key in SCORE_KEYS)
    return f"[score] {details} overall={scores['overall']}"
