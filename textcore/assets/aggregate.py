"""Aggregate read-only knowledge assets across course_state files."""

from __future__ import annotations

import json
from collections.abc import Iterable
from json import JSONDecodeError
from pathlib import Path
from typing import Any, Protocol

CARD_TYPE_ORDER: tuple[str, ...] = (
    "method",
    "person",
    "event",
    "concept",
    "work",
    "theme",
    "mistake",
)
VOCAB_CARD_TYPES = frozenset({"concept", "work"})

LIST_MERGE_FIELDS = frozenset(
    {
        "core_points",
        "related_persons",
        "related_themes",
        "source_chunks",
        "theme",
    }
)


class CourseStateRepository(Protocol):
    processed_dir: Path


def aggregate_assets_from_repository(
    repository: CourseStateRepository,
) -> dict[str, list[dict[str, Any]]]:
    """Build the asset projection from a repository's processed course states."""

    return aggregate_assets_from_processed_dir(repository.processed_dir)


def aggregate_assets_from_processed_dir(processed_dir: Path) -> dict[str, list[dict[str, Any]]]:
    """Load course_state JSON files below data/processed and aggregate their assets."""

    return aggregate_assets(load_course_states(processed_dir))


def load_course_states(processed_dir: Path) -> list[dict[str, Any]]:
    """Read all parseable course_state.json files under a processed directory."""

    states: list[dict[str, Any]] = []
    for path in sorted(processed_dir.glob("*/course_state.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, JSONDecodeError):
            continue
        if isinstance(payload, dict):
            states.append(payload)
    return states


def aggregate_assets(states: Iterable[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Aggregate knowledge cards, writing materials, and temporary vocab rows."""

    cards_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    materials_by_key: dict[tuple[str, str], dict[str, Any]] = {}

    for state in states:
        source = _course_source(state)
        if source is None:
            continue

        for card in _dict_items(state.get("knowledge_cards")):
            asset = _project_card(card, source)
            if asset is None:
                continue
            _merge_by_title_and_source(cards_by_key, asset)

        for material in _dict_items(state.get("writing_materials")):
            asset = _project_material(material, source)
            if asset is None:
                continue
            _merge_by_title_and_source(materials_by_key, asset)

    cards = sorted(cards_by_key.values(), key=_card_sort_key)
    materials = sorted(materials_by_key.values(), key=_asset_sort_key)
    vocab = [dict(card) for card in cards if card.get("type") in VOCAB_CARD_TYPES]
    return {"cards": cards, "materials": materials, "vocab": vocab}


def _project_card(card: dict[str, Any], source: dict[str, str]) -> dict[str, Any] | None:
    title = _clean_text(card.get("title"))
    if not title:
        return None
    asset = _copy_asset_fields(card)
    asset["title"] = title
    asset["source"] = source
    return asset


def _project_material(material: dict[str, Any], source: dict[str, str]) -> dict[str, Any] | None:
    title = _clean_text(material.get("title"))
    if not title:
        return None
    asset = _copy_asset_fields(material)
    asset["title"] = title
    original_source = asset.pop("source", None)
    if original_source:
        asset["material_source"] = original_source
    asset["source"] = source
    return asset


def _copy_asset_fields(item: dict[str, Any]) -> dict[str, Any]:
    copied: dict[str, Any] = {}
    for key, value in item.items():
        if isinstance(value, list):
            copied[key] = list(value)
        elif isinstance(value, dict):
            copied[key] = dict(value)
        else:
            copied[key] = value
    return copied


def _merge_by_title_and_source(
    assets_by_key: dict[tuple[str, str], dict[str, Any]],
    incoming: dict[str, Any],
) -> None:
    key = (_dedupe_title(incoming["title"]), incoming["source"]["course_id"])
    existing = assets_by_key.get(key)
    if existing is None:
        assets_by_key[key] = incoming
        return

    for field, value in incoming.items():
        if field == "source":
            continue
        if field in LIST_MERGE_FIELDS:
            existing[field] = _merge_unique(existing.get(field), value)
        elif _is_empty(existing.get(field)) and not _is_empty(value):
            existing[field] = value


def _merge_unique(first: Any, second: Any) -> list[Any]:
    merged: list[Any] = []
    seen: set[str] = set()
    for value in _as_list(first) + _as_list(second):
        key = (
            json.dumps(value, ensure_ascii=False, sort_keys=True)
            if isinstance(value, dict)
            else str(value)
        )
        if key in seen:
            continue
        seen.add(key)
        merged.append(value)
    return merged


def _course_source(state: dict[str, Any]) -> dict[str, str] | None:
    course_id = _clean_text(state.get("course_id"))
    if not course_id:
        return None

    source = state.get("source") if isinstance(state.get("source"), dict) else {}
    detected_meta = (
        source.get("detected_meta")
        if isinstance(source.get("detected_meta"), dict)
        else {}
    )
    course_title = (
        _clean_text(detected_meta.get("course_title"))
        or _clean_text(source.get("file"))
        or course_id
    )
    return {"course_id": course_id, "course_title": course_title}


def _dict_items(value: Any) -> Iterable[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return (item for item in value if isinstance(item, dict))


def _card_sort_key(item: dict[str, Any]) -> tuple[int, str, str]:
    return (
        CARD_TYPE_ORDER.index(item.get("type"))
        if item.get("type") in CARD_TYPE_ORDER
        else len(CARD_TYPE_ORDER),
        _dedupe_title(item.get("title")),
        item["source"]["course_id"],
    )


def _asset_sort_key(item: dict[str, Any]) -> tuple[str, str]:
    return (_dedupe_title(item.get("title")), item["source"]["course_id"])


def _dedupe_title(value: Any) -> str:
    return _clean_text(value).casefold()


def _clean_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.split())


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _is_empty(value: Any) -> bool:
    return value is None or value == "" or value == []
