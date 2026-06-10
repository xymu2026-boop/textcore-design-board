"""LLM 适配器测试：mock provider + Schema 校验重试（不联网）。"""
import json

import pytest

from textcore.llm import LLMClient, LLMError, MockProvider

SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": False,
    "required": ["cleaned_text", "key_points"],
    "properties": {
        "cleaned_text": {"type": "string"},
        "key_points": {"type": "array", "items": {"type": "string"}},
    },
}


def test_valid_json_passes_first_try():
    payload = {"cleaned_text": "老师讲了线索。", "key_points": ["线索=明线+暗线"]}
    client = LLMClient(MockProvider(lambda s, u: json.dumps(payload, ensure_ascii=False)))
    obj, res = client.complete_json("sys", "user", SCHEMA, stage="S4")
    assert obj == payload
    assert res.model == "deepseek-chat"


def test_retries_on_bad_then_good():
    seq = iter([
        "not json at all",                                  # 第一次：非 JSON
        json.dumps({"cleaned_text": "x"}),                  # 第二次：缺 key_points
        json.dumps({"cleaned_text": "x", "key_points": []}),  # 第三次：合格
    ])
    prov = MockProvider(lambda s, u: next(seq))
    client = LLMClient(prov)
    obj, _ = client.complete_json("sys", "user", SCHEMA, stage="S4", max_retries=3)
    assert obj["key_points"] == []
    assert len(prov.calls) == 3
    # 重试时把错误反馈拼进了 user
    assert "Schema" in prov.calls[2][1] or "JSON" in prov.calls[1][1]


def test_raises_after_max_retries():
    prov = MockProvider(lambda s, u: "{}")  # 永远缺必填
    client = LLMClient(prov)
    with pytest.raises(LLMError):
        client.complete_json("sys", "user", SCHEMA, stage="S4", max_retries=2)
