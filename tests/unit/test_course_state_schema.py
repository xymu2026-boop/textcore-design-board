"""校验 course_state 契约：示例必须通过 Schema，且 Schema 本身合法。"""
import json
from pathlib import Path

import jsonschema
import pytest

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = ROOT / "schemas" / "course_state.schema.json"
EXAMPLE_PATH = ROOT / "schemas" / "course_state.example.json"


def _load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_schema_is_valid_draft_2020():
    schema = _load(SCHEMA_PATH)
    jsonschema.Draft202012Validator.check_schema(schema)


def test_example_conforms_to_schema():
    schema = _load(SCHEMA_PATH)
    example = _load(EXAMPLE_PATH)
    jsonschema.Draft202012Validator(schema).validate(example)


def test_version_keys_match_adr_004():
    """四档英文 key 冻结：faithful/concise/study/outline，默认 concise。"""
    schema = _load(SCHEMA_PATH)
    version_props = schema["properties"]["versions"]["properties"]
    assert set(version_props) == {"faithful", "concise", "study", "outline"}
    assert schema["properties"]["default_version"]["default"] == "concise"


@pytest.mark.parametrize("missing", ["course_id", "schema_version", "source", "status"])
def test_required_top_level_fields_enforced(missing):
    schema = _load(SCHEMA_PATH)
    example = _load(EXAMPLE_PATH)
    example.pop(missing, None)
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(schema).validate(example)
