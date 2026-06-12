from __future__ import annotations

import json
import time
from typing import Any

from textcore.contracts.course_state import VERSION_KEYS
from textcore.llm import LLMClient, MockProvider
from textcore.pipeline.deterministic.version_scaffold import text_char_count
from textcore.pipeline.stages import s7_versions


def test_s7_concise_falls_back_to_scaffold_when_llm_is_too_short() -> None:
    chunks = [_chunk_result("c001", _lesson_text(50))]
    provider = MockProvider(lambda _system, _user: _json({"body_md": "## 太短\n少。"}))

    versions, calls = _run_s7(chunks, provider)
    expected = s7_versions.build_scaffolds(chunks, {})[0]["concise"]["body_md"]
    ratio = versions["concise"]["char_count"] / _source_chars(chunks)

    assert len(calls) == 1
    assert versions["concise"]["body_md"] == expected
    assert ratio >= 0.25
    assert "coverage_scaffold" in provider.calls[0][1]
    assert "hard_min_chars" in provider.calls[0][1]


def test_s7_concise_keeps_normal_llm_result_without_fallback() -> None:
    chunks = [_chunk_result("c001", _lesson_text(50))]
    llm_bodies: list[str] = []

    def handler(_system: str, user: str) -> str:
        payload = json.loads(user)
        body = str(payload["coverage_scaffold"]).replace("\n\n", "\n\nLLM润色保留主线。", 1)
        llm_bodies.append(body)
        return _json({"body_md": body})

    versions, calls = _run_s7(chunks, MockProvider(handler))

    assert len(calls) == 1
    assert versions["concise"]["body_md"] == llm_bodies[0]


def test_s7_study_and_outline_use_deterministic_scaffolds_with_target_ratios() -> None:
    chunks = [
        _chunk_result("c001", _lesson_text(50, offset=0)),
        _chunk_result("c002", _lesson_text(50, offset=100)),
    ]
    provider = MockProvider(_normal_concise_response)

    versions, _calls = _run_s7(chunks, provider)
    source_chars = _source_chars(chunks)

    assert set(versions) == set(VERSION_KEYS)
    assert all(version["body_md"].strip() for version in versions.values())
    assert 0.08 <= versions["study"]["char_count"] / source_chars <= 0.12
    assert 0.04 <= versions["outline"]["char_count"] / source_chars <= 0.07
    assert len(provider.calls) == len(chunks)
    assert not any("S7 学习整理版生成" in call[0] for call in provider.calls)
    assert not any("S7 四档版本生成" in call[0] for call in provider.calls)

    for version in versions.values():
        assert version["char_count"] == text_char_count(version["body_md"])
        assert version["compression"] <= 1


def test_s7_parallel_concise_preserves_chunk_order() -> None:
    chunks = [
        _chunk_result(f"c{index:03d}", _lesson_text(30, offset=index * 100))
        for index in range(1, 6)
    ]

    def handler(_system: str, user: str) -> str:
        payload = json.loads(user)
        chunk_id = str(payload["chunk_id"])
        time.sleep((6 - int(chunk_id.removeprefix("c"))) * 0.01)
        body = f"{payload['coverage_scaffold']}\n\nLLM顺序标记{chunk_id}。"
        return _json({"body_md": body})

    versions, calls = _run_s7(chunks, MockProvider(handler))
    body = versions["concise"]["body_md"]

    expected_ids = [f"c{index:03d}" for index in range(1, 6)]
    positions = [body.index(f"LLM顺序标记{chunk_id}") for chunk_id in expected_ids]
    assert positions == sorted(positions)
    assert len(calls) == len(expected_ids)


def test_s7_parallel_concise_failure_falls_back_per_chunk() -> None:
    chunks = [
        _chunk_result("c001", _lesson_text(30, offset=100)),
        _chunk_result("c002", _lesson_text(30, offset=200)),
    ]
    scaffolds = s7_versions.build_scaffolds(chunks, {})

    def handler(_system: str, user: str) -> str:
        payload = json.loads(user)
        chunk_id = str(payload["chunk_id"])
        if chunk_id == "c002":
            raise RuntimeError("concise failed")
        return _json({"body_md": f"{payload['coverage_scaffold']}\n\nLLM正常{chunk_id}。"})

    versions, calls = _run_s7(chunks, MockProvider(handler))
    body = versions["concise"]["body_md"]

    assert "LLM正常c001" in body
    assert scaffolds[1]["concise"]["body_md"] in body
    assert body.index("LLM正常c001") < body.index(scaffolds[1]["concise"]["body_md"])
    assert len(calls) == 2
    assert all(call["stage"] == "S7" for call in calls)


def _run_s7(
    chunk_results: list[dict[str, Any]],
    provider: MockProvider,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    return s7_versions.run(
        chunk_results=chunk_results,
        classics_refs=[],
        global_result={"outline_tree": []},
        source={},
        course_types={},
        source_char_count=_source_chars(chunk_results),
        llm_client=LLMClient(provider),
    )


def _normal_concise_response(_system: str, user: str) -> str:
    payload = json.loads(user)
    return _json({"body_md": payload["coverage_scaffold"]})


def _chunk_result(chunk_id: str, cleaned_text: str) -> dict[str, Any]:
    return {
        "chunk_id": chunk_id,
        "cleaned_text": cleaned_text,
        "key_points": [],
        "student_answer_kept": [],
        "review_flags": [],
        "entities": {"persons": [], "works": [], "concepts": ["阅读方法"]},
        "classics_candidates": [],
    }


def _lesson_text(sentence_count: int, *, offset: int = 0) -> str:
    sentences: list[str] = []
    markers = ("首先", "其次", "第三", "最后", "因此")
    for index in range(1, sentence_count + 1):
        number = offset + index
        marker = markers[number % len(markers)]
        sentences.append(
            f"{marker}第{number}个课堂例子说明阅读题的核心方法是概括事件，"
            "分析人物动作和环境描写作用，还要结合上下文找到变化原因，"
            "最后回到中心主旨写出表达效果，不能只写人物很感动。"
        )
    return "".join(sentences)


def _source_chars(chunk_results: list[dict[str, Any]]) -> int:
    return sum(text_char_count(str(chunk["cleaned_text"])) for chunk in chunk_results)


def _json(payload: dict[str, object]) -> str:
    return json.dumps(payload, ensure_ascii=False)
