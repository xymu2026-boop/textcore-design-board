from __future__ import annotations

from copy import deepcopy
from pathlib import Path

from fastapi.testclient import TestClient

from apps.api.main import app, get_repository
from textcore.contracts.course_state import load_example
from textcore.storage import CourseRepository


def test_assets_endpoint_returns_aggregated_projection(tmp_path: Path) -> None:
    repo = CourseRepository(tmp_path)
    repo.migrate()

    repo.save_state(
        _state(
            course_id="course_assets_1",
            title="阅读方法课",
            cards=[
                {
                    "card_id": "kc_method_1",
                    "title": "明线与暗线",
                    "type": "method",
                    "summary": "阅读线索方法。",
                },
                {
                    "card_id": "kc_concept_1",
                    "title": "铺垫",
                    "type": "concept",
                    "summary": "前文设置。",
                },
            ],
            materials=[
                {
                    "material_id": "wm_1",
                    "title": "宽容与成长",
                    "source": "课堂阅读讲评",
                    "usable_expression": "父亲把球拍放在枕边。",
                }
            ],
        )
    )
    repo.save_state(
        _state(
            course_id="course_assets_2",
            title="文言文课",
            cards=[
                {
                    "card_id": "kc_work_1",
                    "title": "《醉叟传》",
                    "type": "work",
                    "summary": "人物传记开头。",
                }
            ],
            materials=[],
        )
    )

    app.dependency_overrides[get_repository] = lambda: repo
    try:
        with TestClient(app) as client:
            response = client.get("/api/assets")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {"cards", "materials", "vocab"}
    assert [card["title"] for card in payload["cards"]] == ["明线与暗线", "铺垫", "《醉叟传》"]
    assert payload["cards"][0]["source"] == {
        "course_id": "course_assets_1",
        "course_title": "阅读方法课",
    }
    assert [item["title"] for item in payload["vocab"]] == ["铺垫", "《醉叟传》"]
    assert payload["materials"][0]["source"] == {
        "course_id": "course_assets_1",
        "course_title": "阅读方法课",
    }
    assert payload["materials"][0]["material_source"] == "课堂阅读讲评"


def _state(
    course_id: str,
    title: str,
    cards: list[dict[str, object]],
    materials: list[dict[str, object]],
) -> dict[str, object]:
    state = deepcopy(load_example())
    state["course_id"] = course_id
    state["source"]["detected_meta"]["course_title"] = title
    state["knowledge_cards"] = cards
    state["writing_materials"] = materials
    return state
