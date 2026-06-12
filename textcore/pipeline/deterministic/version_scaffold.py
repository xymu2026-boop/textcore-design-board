"""Build deterministic per-chunk version scaffolds.

Chunk titles are heuristic labels derived from high-ranking local sentences.
They are intentionally generic and are expected to be rewritten by S6/LLM in a
later pipeline phase.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from typing import Any

from textcore.pipeline.deterministic.sentence_ranker import (
    important_sentences,
    select_sentences_to_target,
    sentence_split,
)
from textcore.pipeline.deterministic.transcript_cleaner import clean_transcript_text

VERSION_KEYS = ("faithful", "concise", "study", "outline")


def build_chunk_scaffolds(
    *,
    chunk_id: str,
    title: str,
    original_text: str,
    cleaned_text: str | None = None,
    course_types: Any = None,
    preserve_spans: Iterable[Any] = (),
) -> dict[str, dict[str, Any]]:
    """Return four deterministic version baselines for a single chunk."""

    del course_types  # Future weighting hook; keep the public interface stable.

    source_text = original_text or ""
    source_chars = text_char_count(source_text)
    clean_result = (
        {"text": cleaned_text}
        if cleaned_text is not None
        else clean_transcript_text(source_text, preserve_spans=preserve_spans)
    )
    base_text = str(clean_result.get("text") or "").strip() or source_text.strip()
    base_chars = text_char_count(base_text)
    chunk_title = _derive_chunk_title(title, base_text, chunk_id)

    faithful_md = _section(chunk_id, chunk_title, _paragraph_body(base_text))
    concise_md = _section(
        chunk_id,
        chunk_title,
        _digest_body(base_text, target_chars=min(base_chars, max(760, int(base_chars * 0.32)))),
    )
    study_md = _section(
        chunk_id,
        chunk_title,
        _points_body(base_text, target_chars=min(base_chars, max(160, int(base_chars * 0.095)))),
    )
    outline_md = _section(
        chunk_id,
        chunk_title,
        _outline_body(base_text, target_chars=min(base_chars, max(90, int(base_chars * 0.052)))),
    )

    return {
        "faithful": _version(faithful_md, source_chars),
        "concise": _version(concise_md, source_chars),
        "study": _version(study_md, source_chars),
        "outline": _version(outline_md, source_chars),
    }


def text_char_count(text: str) -> int:
    """Count visible text chars, excluding whitespace and lightweight Markdown."""

    text = re.sub(r"<[^>]+>", "", text or "")
    text = re.sub(r"[#>*`\-\[\]()|]+", "", text)
    return len(re.sub(r"\s+", "", text))


def _version(body_md: str, source_chars: int) -> dict[str, Any]:
    char_count = text_char_count(body_md)
    compression = round(char_count / source_chars, 4) if source_chars else 0.0
    return {
        "body_md": body_md,
        "char_count": char_count,
        "compression": min(compression, 1.0),
    }


def _derive_chunk_title(title: str, text: str, chunk_id: str) -> str:
    provided = (title or "").strip()
    if provided and not re.fullmatch(r"c\d{2,4}|片段\s*\d+", provided, flags=re.IGNORECASE):
        return _compact_title(provided)

    for sentence in important_sentences(text, 3):
        compact = _compact_title(sentence)
        if compact:
            return compact

    for sentence in sentence_split(text):
        compact = _compact_title(sentence)
        if compact:
            return compact
    return f"课堂片段 {chunk_id}"


def _compact_title(text: str, limit: int = 24) -> str:
    text = re.sub(r"^[#\-\s\d一二三四五六七八九十、.．：:]+", "", text or "").strip()
    text = re.sub(r"\s+", "", text)
    text = re.split(r"[。！？；，,：:]", text, maxsplit=1)[0].strip()
    if len(text) > limit:
        return f"{text[:limit]}..."
    return text


def _section(chunk_id: str, title: str, body: str) -> str:
    body = body.strip()
    if not body:
        body = "本段暂无可抽取内容。"
    return f"## {chunk_id} {title}\n\n{body}"


def _paragraph_body(text: str) -> str:
    paragraphs = [line.strip() for line in re.split(r"\n+", text or "") if line.strip()]
    return "\n\n".join(paragraphs)


def _digest_body(text: str, *, target_chars: int) -> str:
    selected = select_sentences_to_target(text, target_chars=target_chars, min_score=1)
    if not selected:
        selected = _fallback_sentences(text, target_chars)
    groups = ["".join(selected[index : index + 3]) for index in range(0, len(selected), 3)]
    return "\n\n".join(group for group in groups if group)


def _points_body(text: str, *, target_chars: int) -> str:
    points = _important_to_target(text, target_chars=target_chars, max_items=8, item_limit=132)
    if not points:
        points = _fallback_sentences(text, target_chars, item_limit=132)
    return "\n".join(f"- {point}" for point in points)


def _outline_body(text: str, *, target_chars: int) -> str:
    points = _important_to_target(text, target_chars=target_chars, max_items=3, item_limit=96)
    if not points:
        points = _fallback_sentences(text, target_chars, item_limit=96)
    lines = [f"- 核心：{points[0]}"]
    if len(points) > 1:
        lines.append(f"- 抓手：{points[1]}")
    return "\n".join(lines)


def _important_to_target(
    text: str,
    *,
    target_chars: int,
    max_items: int,
    item_limit: int,
) -> list[str]:
    candidates = important_sentences(text, max_items * 2)
    selected: list[str] = []
    total = 0
    for sentence in candidates:
        item = _trim_sentence(sentence, item_limit)
        if not item:
            continue
        selected.append(item)
        total += text_char_count(item)
        if total >= target_chars or len(selected) >= max_items:
            break
    return selected


def _fallback_sentences(text: str, target_chars: int, item_limit: int | None = None) -> list[str]:
    selected: list[str] = []
    total = 0
    for sentence in sentence_split(text):
        item = _trim_sentence(sentence, item_limit) if item_limit else sentence.strip()
        if not item:
            continue
        selected.append(item)
        total += text_char_count(item)
        if total >= target_chars:
            break
    if selected:
        return selected

    compact = re.sub(r"\s+", "", text or "")
    if not compact:
        return []
    limit = item_limit or max(target_chars, 80)
    return [_trim_sentence(compact, limit)]


def _trim_sentence(sentence: str, limit: int | None) -> str:
    sentence = re.sub(r"\s+", "", sentence or "").strip()
    if not limit or len(sentence) <= limit:
        return sentence
    return f"{sentence[:limit]}..."
