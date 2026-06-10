"""course_state 契约的 Python 入口。

JSON Schema (`schemas/course_state.schema.json`) 是**唯一真相**。
本模块不复刻字段（避免漂移），只提供：常量、加载、校验。
后端写库前、LLM 阶段产出后，都应调 `validate()` 卡门。
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import jsonschema

# schemas/ 在仓库根；本文件位于 textcore/contracts/
_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = _ROOT / "schemas" / "course_state.schema.json"
EXAMPLE_PATH = _ROOT / "schemas" / "course_state.example.json"

# 四档版本 key（冻结，见 ADR-004）。中文显示名属于前端，不在此。
VERSION_KEYS: tuple[str, ...] = ("faithful", "concise", "study", "outline")
DEFAULT_VERSION: str = "concise"

SCHEMA_VERSION: str = "1.0"

# 流水线阶段顺序（S0–S10）
STAGES: tuple[str, ...] = (
    "S0", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10",
)


@lru_cache(maxsize=1)
def load_schema() -> dict[str, Any]:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _validator() -> jsonschema.Draft202012Validator:
    return jsonschema.Draft202012Validator(load_schema())


def validate(state: dict[str, Any]) -> None:
    """不合契约则抛 jsonschema.ValidationError。"""
    _validator().validate(state)


def is_valid(state: dict[str, Any]) -> bool:
    return _validator().is_valid(state)


def validate_subschema(obj: Any, def_name: str) -> None:
    """校验单个对象是否符合某个 $defs 子类型（供 LLM 阶段产出卡门）。

    例：validate_subschema(card, "knowledgeCard")。
    """
    schema = load_schema()
    if def_name not in schema.get("$defs", {}):
        raise KeyError(f"unknown $defs: {def_name}")
    sub = {**schema["$defs"][def_name], "$defs": schema["$defs"]}
    jsonschema.Draft202012Validator(sub).validate(obj)


def load_example() -> dict[str, Any]:
    return json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
