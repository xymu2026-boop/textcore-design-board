"""Pure-rule quality rubric for completed course states."""

from __future__ import annotations

import re
from html import unescape
from typing import Any

from textcore.pipeline.deterministic.sentence_ranker import DEFAULT_KEYWORD_SETS
from textcore.pipeline.deterministic.version_scaffold import VERSION_KEYS, text_char_count

SCORE_KEYS = (
    "coverage",
    "structure",
    "fluency",
    "coherence",
    "classics_safety",
)

ORAL_RESIDUE_TERMS = ("嗯", "呃", "这个", "那个", "是不是", "对吧", "能理解吧")
COHERENCE_MARKERS = ("因此", "所以", "换句话说", "首先", "其次")

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_HEADING_MD_RE = re.compile(r"^\s{0,3}(#{1,6})\s+\S+", flags=re.MULTILINE)
_HEADING_HTML_RE = re.compile(r"<h([1-6])\b[^>]*>", flags=re.IGNORECASE)
_REPEATED_PUNCT_RE = re.compile(r"([。！？!?，,、；;：:])\1+|\.{3,}")
_SENTENCE_BOUNDARY_RE = re.compile(r"[。！？；!?;\n]+")
_MATCH_DROP_RE = re.compile(r"[\s#>*`\-\[\]()|《》〈〉「」『』“”\"'，。！？；：、,.!?;:]+")


def score_course(course_state: dict[str, Any]) -> dict[str, int]:
    """Return five rubric dimensions plus an overall score, all in 0-100."""

    scores = {
        "coverage": _score_coverage(course_state),
        "structure": _score_structure(course_state),
        "fluency": _score_fluency(course_state),
        "coherence": _score_coherence(course_state),
        "classics_safety": _score_classics_safety(course_state),
    }
    scores["overall"] = _clamp_score(sum(scores[key] for key in SCORE_KEYS) / len(SCORE_KEYS))
    return scores


def _score_coverage(course_state: dict[str, Any]) -> int:
    versions = _versions(course_state)
    faithful_text = _plain_text(versions.get("faithful", {}).get("body_md", ""))
    chunk_results = _list(course_state.get("chunk_results"))
    baseline_text = "\n".join(
        [
            faithful_text,
            _chunk_reference_text(chunk_results),
        ]
    )
    target_text = "\n".join(
        _plain_text(versions.get(key, {}).get("body_md", "")) for key in ("concise", "study")
    )
    if not target_text.strip():
        return 0

    keyword_terms = [
        term for term in _sentence_ranker_terms() if _contains_term(baseline_text, term)
    ]
    entity_terms = _entity_terms(chunk_results)
    keyword_score = _retention_score(keyword_terms, target_text)
    entity_score = _retention_score(entity_terms, target_text)

    if keyword_score is None and entity_score is None:
        return 100 if faithful_text.strip() else 0
    if keyword_score is None:
        return entity_score or 0
    if entity_score is None:
        return keyword_score
    return _clamp_score(keyword_score * 0.55 + entity_score * 0.45)


def _score_structure(course_state: dict[str, Any]) -> int:
    versions = _versions(course_state)
    chunk_items = _chunk_items(course_state)
    chunk_count = len(chunk_items)
    heading_scores = [
        _version_heading_score(str(versions.get(key, {}).get("body_md", "")), chunk_count)
        for key in VERSION_KEYS
    ]
    nonempty_heading_scores = [score for score in heading_scores if score is not None]
    if not nonempty_heading_scores:
        return 0

    heading_score = sum(nonempty_heading_scores) / len(nonempty_heading_scores)
    if chunk_count <= 0:
        return _clamp_score(heading_score)

    chunk_coverage = _chunk_coverage_score(chunk_items, _all_version_text(versions))
    return _clamp_score(heading_score * 0.6 + chunk_coverage * 0.4)


def _score_fluency(course_state: dict[str, Any]) -> int:
    text = _plain_text(
        "\n".join(
            str(_versions(course_state).get(key, {}).get("body_md", ""))
            for key in ("faithful", "concise", "study")
        )
    )
    chars = text_char_count(text)
    if chars <= 0:
        return 0

    oral_count = sum(text.count(term) for term in ORAL_RESIDUE_TERMS)
    oral_rate = oral_count * 1000 / chars
    repeated_rate = len(_REPEATED_PUNCT_RE.findall(text)) * 1000 / chars
    sentences = _quality_sentences(text)
    long_ratio = (
        sum(1 for sentence in sentences if text_char_count(sentence) > 160) / len(sentences)
        if sentences
        else 1.0
    )

    penalty = min(55.0, oral_rate * 4.0)
    penalty += min(25.0, repeated_rate * 10.0)
    penalty += min(35.0, long_ratio * 100.0)
    return _clamp_score(100 - penalty)


def _score_coherence(course_state: dict[str, Any]) -> int:
    versions = _versions(course_state)
    concise_text = _plain_text(str(versions.get("concise", {}).get("body_md", "")))
    study_text = _plain_text(str(versions.get("study", {}).get("body_md", "")))
    text = concise_text or study_text or _plain_text(
        str(versions.get("faithful", {}).get("body_md", ""))
    )
    if not text.strip():
        return 0

    chunk_count = len(_chunk_items(course_state))
    marker_text = "\n".join(part for part in (concise_text, study_text) if part)
    marker_count = sum(marker_text.count(marker) for marker in COHERENCE_MARKERS)
    expected_markers = max(
        1,
        min(8, chunk_count // 2 if chunk_count else text_char_count(text) // 800),
    )
    marker_score = 45 + 55 * min(marker_count / expected_markers, 1.0)
    paragraph_score = _paragraph_chunk_score(text, chunk_count)
    return _clamp_score(marker_score * 0.45 + paragraph_score * 0.55)


def _score_classics_safety(course_state: dict[str, Any]) -> int:
    """古文安全 = 保留 span 在保真版中未被改 + 转写错字进了复核。

    注意：我们刻意"原文不静默替换"——权威 canonical 存在 classics_refs 供旁征博引，
    正文用的是转写稿。所以不能要求 canonical 逐字出现在正文里(那是架构错误的旧逻辑)。
    正确的安全信号是：(1) 老师所念的文言文/诗词原句(must_preserve_spans)在保真版里
    原样保留、没被清洗/润色改坏；(2) 转写与权威不一致处(diffs)都已进 review_flags。
    """
    refs = [
        ref
        for ref in _list(course_state.get("classics_refs"))
        if isinstance(ref, dict) and ref.get("matched")
    ]
    # must_preserve_spans 在真实流水线里挂在 chunks 上(S3 产出)，不在 chunk_results
    spans = [
        str(span.get("text") or "").strip()
        for chunk in _list(course_state.get("chunks"))
        if isinstance(chunk, dict)
        for span in _list(chunk.get("must_preserve_spans"))
        if isinstance(span, dict) and str(span.get("text") or "").strip()
    ]
    if not refs and not spans:
        return 100

    # (1) 保留 span 完整性：原句应原样出现在保真版正文
    faithful_text = _plain_text(str(_versions(course_state).get("faithful", {}).get("body_md", "")))
    if spans:
        kept = sum(1 for span in spans if _contains_term(faithful_text, span))
        preserve_score = kept * 100 / len(spans)
    else:
        preserve_score = 100.0

    # (2) 错字 diff 标记率
    diffs = [
        (ref, diff)
        for ref in refs
        for diff in _list(ref.get("diffs"))
        if isinstance(diff, dict)
    ]
    if diffs:
        review_flags = [
            flag for flag in _list(course_state.get("review_flags")) if isinstance(flag, dict)
        ]
        diff_hits = sum(1 for ref, diff in diffs if _diff_has_review_flag(ref, diff, review_flags))
        diff_score = diff_hits * 100 / len(diffs)
    else:
        diff_score = 100.0

    return _clamp_score(preserve_score * 0.6 + diff_score * 0.4)


def _versions(course_state: dict[str, Any]) -> dict[str, Any]:
    versions = course_state.get("versions")
    return versions if isinstance(versions, dict) else {}


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _sentence_ranker_terms() -> list[str]:
    terms: list[str] = []
    for config in DEFAULT_KEYWORD_SETS.values():
        raw_terms = config.get("terms", ()) if isinstance(config, dict) else ()
        for term in raw_terms:
            if isinstance(term, str) and term.strip() and term not in terms:
                terms.append(term)
    return terms


def _entity_terms(chunk_results: list[Any]) -> list[str]:
    terms: list[str] = []
    for chunk_result in chunk_results:
        if not isinstance(chunk_result, dict):
            continue
        entities = chunk_result.get("entities")
        if not isinstance(entities, dict):
            continue
        for values in entities.values():
            for value in _list(values):
                term = str(value).strip()
                if len(_match_text(term)) >= 2 and term not in terms:
                    terms.append(term)
    return terms


def _chunk_reference_text(chunk_results: list[Any]) -> str:
    parts: list[str] = []
    for chunk_result in chunk_results:
        if not isinstance(chunk_result, dict):
            continue
        for key in ("cleaned_text", "source_text", "original_text"):
            value = chunk_result.get(key)
            if isinstance(value, str) and value.strip():
                parts.append(value)
        parts.extend(
            str(point) for point in _list(chunk_result.get("key_points")) if str(point).strip()
        )
    return "\n".join(parts)


def _retention_score(terms: list[str], target_text: str) -> int | None:
    if not terms:
        return None
    hits = sum(1 for term in terms if _contains_term(target_text, term))
    return _clamp_score(hits * 100 / len(terms))


def _version_heading_score(text: str, chunk_count: int) -> int | None:
    if not str(text).strip():
        return None
    heading_count, levels = _heading_stats(text)
    if chunk_count > 0:
        count_score = min(heading_count / chunk_count, 1.0) * 100
    elif heading_count >= 2:
        count_score = 100
    elif heading_count == 1:
        count_score = 70
    else:
        count_score = 20

    if len(levels) >= 2:
        hierarchy_score = 100
    elif levels:
        hierarchy_score = 65
    else:
        hierarchy_score = 20
    return _clamp_score(count_score * 0.7 + hierarchy_score * 0.3)


def _heading_stats(text: str) -> tuple[int, set[int]]:
    markdown_levels = [len(match.group(1)) for match in _HEADING_MD_RE.finditer(text)]
    html_levels = [int(match.group(1)) for match in _HEADING_HTML_RE.finditer(text)]
    levels = set(markdown_levels + html_levels)
    return len(markdown_levels) + len(html_levels), levels


def _chunk_items(course_state: dict[str, Any]) -> list[dict[str, Any]]:
    chunk_results = [
        item for item in _list(course_state.get("chunk_results")) if isinstance(item, dict)
    ]
    if chunk_results:
        return chunk_results
    return [item for item in _list(course_state.get("chunks")) if isinstance(item, dict)]


def _chunk_coverage_score(chunk_items: list[dict[str, Any]], text: str) -> int:
    if not chunk_items:
        return 100
    hits = 0
    for chunk in chunk_items:
        signals = _chunk_signals(chunk)
        if signals and any(_contains_term(text, signal) for signal in signals):
            hits += 1
    return _clamp_score(hits * 100 / len(chunk_items))


def _chunk_signals(chunk: dict[str, Any]) -> list[str]:
    signals: list[str] = []
    chunk_id = str(chunk.get("chunk_id") or "").strip()
    if chunk_id:
        signals.append(chunk_id)
    title = str(chunk.get("title") or "").strip()
    if title:
        signals.append(title)
    for point in _list(chunk.get("key_points"))[:3]:
        compact = _compact_signal(str(point))
        if compact:
            signals.append(compact)
    return signals


def _compact_signal(text: str) -> str:
    compact = _match_text(text)
    if len(compact) < 8:
        return ""
    return compact[:24]


def _quality_sentences(text: str) -> list[str]:
    return [part.strip() for part in _SENTENCE_BOUNDARY_RE.split(text) if text_char_count(part) > 0]


def _paragraph_chunk_score(text: str, chunk_count: int) -> int:
    paragraphs = _paragraph_count(text)
    if paragraphs <= 0:
        return 0
    if chunk_count <= 0:
        return 85 if paragraphs >= 2 else 55

    ratio = paragraphs / chunk_count
    if 0.75 <= ratio <= 3.0:
        return 100
    if 0.5 <= ratio < 0.75:
        return _clamp_score(75 + (ratio - 0.5) / 0.25 * 25)
    if 3.0 < ratio <= 4.5:
        return _clamp_score(100 - (ratio - 3.0) / 1.5 * 25)
    if ratio < 0.5:
        return _clamp_score(ratio / 0.5 * 70)
    return _clamp_score(max(35, 75 - (ratio - 4.5) * 10))


def _paragraph_count(text: str) -> int:
    lines = [line.strip() for line in re.split(r"\n+", text) if text_char_count(line) > 0]
    if not lines:
        return 0
    blocks = [block for block in re.split(r"\n\s*\n+", text) if text_char_count(block) > 0]
    return max(len(blocks), len([line for line in lines if line.startswith(("#", "-", "*"))]))


def _diff_has_review_flag(
    ref: dict[str, Any],
    diff: dict[str, Any],
    review_flags: list[dict[str, Any]],
) -> bool:
    raw = str(diff.get("raw") or "").strip()
    canonical = str(diff.get("canonical") or "").strip()
    chunk_id = str(ref.get("chunk_id") or "")
    for flag in review_flags:
        if chunk_id and str(flag.get("chunk_id") or "") not in ("", chunk_id):
            continue
        text = str(flag.get("text") or "")
        suggestion = str(flag.get("suggestion") or "")
        reason = str(flag.get("reason") or "")
        if raw and _contains_term(text, raw):
            return True
        if canonical and _contains_term(suggestion, canonical):
            return True
        if flag.get("category") == "classical_typo" and ("古文" in reason or "原文" in reason):
            return True
    return False


def _all_version_text(versions: dict[str, Any]) -> str:
    return "\n".join(
        _plain_text(str(versions.get(key, {}).get("body_md", ""))) for key in VERSION_KEYS
    )


def _plain_text(text: str) -> str:
    return unescape(_HTML_TAG_RE.sub("\n", str(text or "")))


def _contains_term(text: str, term: str) -> bool:
    needle = _match_text(term)
    return bool(needle) and needle in _match_text(text)


def _match_text(text: str) -> str:
    return _MATCH_DROP_RE.sub("", _plain_text(str(text or "")).lower())


def _clamp_score(value: float | int) -> int:
    return max(0, min(100, int(round(float(value)))))
