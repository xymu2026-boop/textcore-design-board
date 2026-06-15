from __future__ import annotations

import json
from pathlib import Path

from textcore.assets.aggregate import aggregate_assets, aggregate_assets_from_processed_dir


def test_aggregate_assets_groups_sources_and_deduplicates_by_title_and_course() -> None:
    result = aggregate_assets(
        [
            {
                "course_id": "course_1",
                "source": {
                    "file": "fallback.docx",
                    "detected_meta": {"course_title": "第一课"},
                },
                "knowledge_cards": [
                    {
                        "card_id": "kc_1",
                        "title": "明线与暗线",
                        "type": "method",
                        "summary": "阅读线索方法。",
                        "core_points": ["明线看事件"],
                        "source_chunks": ["c001"],
                    },
                    {
                        "card_id": "kc_1_duplicate",
                        "title": " 明线与暗线 ",
                        "type": "method",
                        "core_points": ["暗线看心理"],
                        "source_chunks": ["c002"],
                    },
                    {
                        "card_id": "kc_2",
                        "title": "铺垫",
                        "type": "concept",
                        "summary": "前文设置。",
                    },
                ],
                "writing_materials": [
                    {
                        "material_id": "wm_1",
                        "title": "宽容与成长",
                        "source": "课堂阅读讲评",
                        "theme": ["成长"],
                        "source_chunks": ["c001"],
                    },
                    {
                        "material_id": "wm_1_duplicate",
                        "title": "宽容与成长",
                        "theme": ["宽容"],
                        "source_chunks": ["c002"],
                    },
                ],
            },
            {
                "course_id": "course_2",
                "source": {"file": "第二课.docx"},
                "knowledge_cards": [
                    {
                        "card_id": "kc_3",
                        "title": "明线与暗线",
                        "type": "method",
                    },
                    {
                        "card_id": "kc_4",
                        "title": "《醉叟传》",
                        "type": "work",
                    },
                ],
                "writing_materials": [],
            },
        ]
    )

    assert [card["title"] for card in result["cards"]] == [
        "明线与暗线",
        "明线与暗线",
        "铺垫",
        "《醉叟传》",
    ]
    assert result["cards"][0]["source"] == {
        "course_id": "course_1",
        "course_title": "第一课",
    }
    assert result["cards"][0]["core_points"] == ["明线看事件", "暗线看心理"]
    assert result["cards"][0]["source_chunks"] == ["c001", "c002"]
    assert result["cards"][1]["source"] == {
        "course_id": "course_2",
        "course_title": "第二课.docx",
    }

    assert [item["title"] for item in result["vocab"]] == ["铺垫", "《醉叟传》"]
    assert result["materials"] == [
        {
            "material_id": "wm_1",
            "title": "宽容与成长",
            "theme": ["成长", "宽容"],
            "source_chunks": ["c001", "c002"],
            "material_source": "课堂阅读讲评",
            "source": {"course_id": "course_1", "course_title": "第一课"},
        }
    ]


def test_aggregate_assets_from_processed_dir_reads_fixture_states(tmp_path: Path) -> None:
    course_dir = tmp_path / "course_a"
    course_dir.mkdir()
    (course_dir / "course_state.json").write_text(
        json.dumps(
            {
                "course_id": "course_a",
                "schema_version": "1.0",
                "status": "completed",
                "source": {"file": "A.docx"},
                "knowledge_cards": [{"card_id": "kc_a", "title": "借景抒情", "type": "theme"}],
                "writing_materials": [],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    broken_dir = tmp_path / "course_b"
    broken_dir.mkdir()
    (broken_dir / "course_state.json").write_text("{", encoding="utf-8")

    result = aggregate_assets_from_processed_dir(tmp_path)

    assert len(result["cards"]) == 1
    assert result["cards"][0]["source"] == {
        "course_id": "course_a",
        "course_title": "A.docx",
    }
    assert result["materials"] == []
    assert result["vocab"] == []
