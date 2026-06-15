"""Sentence splitting and ranking for language-arts transcript scaffolds."""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from typing import Any

KeywordSets = Mapping[str, Any]

DEFAULT_KEYWORD_SETS: dict[str, dict[str, Any]] = {
    "discourse_markers": {
        "weight": 3,
        "terms": (
            "第一",
            "第二",
            "第三",
            "首先",
            "其次",
            "最后",
            "所以",
            "因此",
            "总之",
            "注意",
            "重点",
            "核心",
            "关键",
            "说明",
            "意味着",
            "总结",
        ),
    },
    "method": {
        "weight": 4,
        "terms": ("方法", "步骤", "技巧", "规律", "原则", "思路"),
    },
    "reading_question": {
        "weight": 4,
        "terms": (
            "题型",
            "答题",
            "概括",
            "赏析",
            "分析",
            "作用",
            "表达效果",
            "中心",
            "主旨",
            "引用",
            "比喻",
            "修辞",
        ),
    },
    "composition": {
        "weight": 3,
        "terms": (
            "作文",
            "立意",
            "选材",
            "结构",
            "开头",
            "结尾",
            "语言",
            "详略",
            "描写",
            "议论",
        ),
    },
    "classical_poetry": {
        "weight": 3,
        "terms": (
            "文言文",
            "古诗",
            "词",
            "句读",
            "翻译",
            "字词",
            "通假",
            "活用",
            "意象",
            "典故",
        ),
    },
}

_SENTENCE_END_RE = re.compile(r"(?<=[。！？；!?])")
_SOFT_SPLIT_RE = re.compile(r"(?<=[，,、：:])")
_NOISE_RE = re.compile(
    r"(转写噪声|听得到吗|看屏幕|共享屏幕|上麦|下麦|开麦|提交|上传|班级群|"
    r"哈哈|呵呵)"
)


def sentence_split(text: str) -> list[str]:
    """Split Chinese classroom transcript text into usable sentence units."""

    sentences: list[str] = []
    for paragraph in re.split(r"\n+", text or ""):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        rough_parts = [part.strip() for part in _SENTENCE_END_RE.split(paragraph) if part.strip()]
        for part in rough_parts:
            sentences.extend(_split_long_sentence(part))
    return [sentence for sentence in sentences if len(sentence) >= 6]


def score_sentence(
    sentence: str,
    position: int,
    *,
    keyword_sets: KeywordSets = DEFAULT_KEYWORD_SETS,
) -> int:
    """Score a sentence using category keyword weights and generic penalties."""

    text = sentence.strip()
    length = len(text)
    if length < 6:
        return -4
    score = 0

    for config in keyword_sets.values():
        terms, weight = _terms_and_weight(config)
        for term in terms:
            if term and term in text:
                score += weight

    if 18 <= length <= 150:
        score += 2
    elif 10 <= length < 18:
        score += 1
    elif length > 220:
        score -= 4
    elif length > 170:
        score -= 2

    if position <= 2:
        score += 2
    elif position <= 5:
        score += 1

    if _NOISE_RE.search(text):
        score -= 6
    if length > 120 and len(re.findall(r"[。！？；!?]", text)) == 0 and text.count("我") >= 10:
        score -= 5
    if _filler_ratio(text) >= 0.16:
        score -= 4
    return score


def important_sentences(
    text_or_paragraphs: str | Sequence[str],
    limit: int,
    *,
    keyword_sets: KeywordSets = DEFAULT_KEYWORD_SETS,
) -> list[str]:
    """Return top-ranked non-duplicate sentences in descending importance."""

    ranked = rank_sentences(text_or_paragraphs, keyword_sets=keyword_sets)
    selected: list[str] = []
    seen: set[str] = set()
    for item in sorted(ranked, key=lambda row: (-row["score"], row["order"])):
        sentence = item["sentence"]
        key = _dedupe_key(sentence)
        if key in seen:
            continue
        seen.add(key)
        selected.append(sentence)
        if len(selected) >= limit:
            return selected

    for item in ranked:
        sentence = item["sentence"]
        key = _dedupe_key(sentence)
        if key in seen or _NOISE_RE.search(sentence):
            continue
        seen.add(key)
        selected.append(sentence)
        if len(selected) >= limit:
            break
    return selected


def rank_sentences(
    text_or_paragraphs: str | Sequence[str],
    *,
    keyword_sets: KeywordSets = DEFAULT_KEYWORD_SETS,
) -> list[dict[str, Any]]:
    """Return sentences with score and stable source order."""

    text = _coerce_text(text_or_paragraphs)
    ranked: list[dict[str, Any]] = []
    for order, sentence in enumerate(sentence_split(text), start=1):
        ranked.append(
            {
                "order": order,
                "sentence": sentence,
                "score": score_sentence(sentence, order, keyword_sets=keyword_sets),
            }
        )
    return ranked


def select_sentences_to_target(
    text_or_paragraphs: str | Sequence[str],
    *,
    target_chars: int,
    keyword_sets: KeywordSets = DEFAULT_KEYWORD_SETS,
    min_score: int = 1,
) -> list[str]:
    """Select ranked sentences until target length is reached, then restore order."""

    ranked = rank_sentences(text_or_paragraphs, keyword_sets=keyword_sets)
    if not ranked:
        return []

    selected_orders: set[int] = set()
    selected_chars = 0
    seen: set[str] = set()
    for item in sorted(ranked, key=lambda row: (-row["score"], row["order"])):
        if item["score"] < min_score:
            continue
        sentence = item["sentence"]
        key = _dedupe_key(sentence)
        if key in seen:
            continue
        seen.add(key)
        selected_orders.add(item["order"])
        selected_chars += len(sentence)
        if selected_chars >= target_chars:
            break

    if selected_chars < target_chars:
        for item in ranked:
            sentence = item["sentence"]
            key = _dedupe_key(sentence)
            if item["order"] in selected_orders or key in seen or _NOISE_RE.search(sentence):
                continue
            seen.add(key)
            selected_orders.add(item["order"])
            selected_chars += len(sentence)
            if selected_chars >= target_chars:
                break

    return [item["sentence"] for item in ranked if item["order"] in selected_orders]


def _split_long_sentence(sentence: str) -> list[str]:
    sentence = sentence.strip()
    if len(sentence) <= 190:
        return [sentence]

    parts = [part.strip() for part in _SOFT_SPLIT_RE.split(sentence) if part.strip()]
    if len(parts) <= 1:
        return [sentence]

    chunks: list[str] = []
    current = ""
    for part in parts:
        if current and len(current) + len(part) > 150:
            chunks.append(current)
            current = part
        else:
            current += part
    if current:
        chunks.append(current)
    return chunks


def _terms_and_weight(config: Any) -> tuple[Sequence[str], int]:
    if isinstance(config, Mapping):
        terms = tuple(str(term) for term in config.get("terms", ()))
        weight = int(config.get("weight", 1))
        return terms, weight
    return tuple(str(term) for term in config), 1


def _coerce_text(text_or_paragraphs: str | Sequence[str]) -> str:
    if isinstance(text_or_paragraphs, str):
        return text_or_paragraphs
    return "\n".join(str(paragraph) for paragraph in text_or_paragraphs)


def _filler_ratio(text: str) -> float:
    filler_chars = sum(
        len(match.group(0))
        for match in re.finditer(r"(嗯|呃|这个|那个|是不是|对吧|能理解吧)", text)
    )
    return filler_chars / max(len(text), 1)


def _dedupe_key(sentence: str) -> str:
    return re.sub(r"\s+", "", sentence)[:32]
