"""Generic transcript cleanup for deterministic scaffolds.

This module intentionally avoids article-specific typo corrections. Low
confidence suspicious phrases are surfaced as review flags so S5 or a human can
verify them against source material later.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from typing import Any

_PLACEHOLDER_PREFIX = "\ue000TEXTCORE_PRESERVE_"
_PLACEHOLDER_SUFFIX = "\ue001"

_SPEAKER_TIMESTAMP_RE = re.compile(
    r"(?m)^\s*(?:[\u4e00-\u9fffA-Za-z][\u4e00-\u9fffA-Za-zA-Z·._-]{0,24}\s+)?"
    r"(?:\[\d{1,2}:\d{2}(?::\d{2})?\]|\d{1,2}:\d{2}:\d{2})\s*"
)
_SPEAKER_PREFIX_RE = re.compile(
    r"(?m)^\s*(?:老师|教师|讲师|助教|学生|同学|男生|女生|家长|主持人|Teacher|Student)"
    r"\s*[:：]\s*",
    flags=re.IGNORECASE,
)
_FILLER_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:呵呵|哈哈)[，,。！!\s]*"),
    re.compile(r"[嗯呃]{1,3}[，,。！？?\s]*"),
    re.compile(r"啊"),
    re.compile(r"一下"),
    re.compile(r"(?<=[\u4e00-\u9fff])(?:啊|呢|嘛)(?=[，,。！？?\s])"),
    re.compile(r"(?:是吧|好吧)[？?，,。！!\s]*"),
    re.compile(r"(?:能理解(?:吗|吧)|懂了吗|明白了吗|有没有(?:看到|发现|感受到))[？?，,。！!\s]*"),
    re.compile(
        r"(?m)(?:^|(?<=[。！？；，,\n]))\s*(?:然后|那么|好)[，,。！!\s]*"
        r"(?=我们|大家|接下来|来看|看|第|这个|把|来)"
    ),
    re.compile(r"(?:这个|那个){1,2}[，,。！？?\s]*"),
    re.compile(r"是不是(?:啊|呀)?[？?，,。！!\s]*"),
    re.compile(r"对吧[？?，,。！!\s]*"),
    re.compile(r"能理解吧[？?，,。！!\s]*"),
)
_CLASSROOM_MANAGEMENT_RE = re.compile(
    r"(安静|静一下|听得到|看屏幕|共享屏幕|上麦|下麦|开麦|关麦|请坐|谁来读|"
    r"请.{0,8}读|提交|上传|班级群|作业发|拿稿纸|翻到第.{0,8}页|摄像头|"
    r"视频会议)"
)
_SUSPICIOUS_ASR_RE = re.compile(
    r"(通甲字|公假字|古今异意|词类或用|句逗|听不清|识别不出|转写错误|"
    r"字幕错误|不确定|可能不对|这里错了)"
)
_NOISE_RE = re.compile(r"(?:[A-Za-z]{3,}\s*){3,}|[□�]{1,}")


def clean_transcript_text(
    text: str,
    *,
    preserve_spans: Iterable[Any] = (),
) -> dict[str, Any]:
    """Return cleaned text plus deterministic review metadata.

    ``preserve_spans`` may contain either raw strings or dictionaries with a
    ``text`` key. Matching spans are replaced with private placeholders before
    cleanup, so classical originals, poems, and student composition sentences
    are restored byte-for-byte.
    """

    original = text or ""
    protected_text, protected_spans = _mask_preserve_spans(original, preserve_spans)
    review_flags = _review_flags(protected_text)

    cleaned = protected_text.replace("\r\n", "\n").replace("\r", "\n")
    cleaned = cleaned.replace("\u3000", " ")
    cleaned = _SPEAKER_TIMESTAMP_RE.sub("", cleaned)
    cleaned = _SPEAKER_PREFIX_RE.sub("", cleaned)
    cleaned = _remove_classroom_management_lines(cleaned)
    for pattern in _FILLER_PATTERNS:
        cleaned = pattern.sub("", cleaned)
    cleaned = _compress_punctuation(cleaned)
    cleaned = _normalize_spacing(cleaned)
    cleaned = _restore_preserve_spans(cleaned, protected_spans)

    return {
        "text": cleaned.strip(),
        "review_flags": review_flags,
        "applied_repairs": [],
    }


def _extract_span_text(span: Any) -> str:
    if isinstance(span, str):
        return span
    if isinstance(span, dict):
        return str(span.get("text") or "")
    return ""


def _mask_preserve_spans(text: str, preserve_spans: Iterable[Any]) -> tuple[str, list[str]]:
    masked = text
    protected: list[str] = []
    seen: set[str] = set()
    for span in preserve_spans:
        span_text = _extract_span_text(span)
        if not span_text or span_text in seen or span_text not in masked:
            continue
        placeholder = _placeholder(len(protected))
        masked = masked.replace(span_text, placeholder)
        protected.append(span_text)
        seen.add(span_text)
    return masked, protected


def _placeholder(index: int) -> str:
    return f"{_PLACEHOLDER_PREFIX}{index}{_PLACEHOLDER_SUFFIX}"


def _restore_preserve_spans(text: str, protected_spans: list[str]) -> str:
    restored = text
    for index, span_text in enumerate(protected_spans):
        restored = restored.replace(_placeholder(index), span_text)
    return restored


def _remove_classroom_management_lines(text: str) -> str:
    kept: list[str] = []
    for raw_line in text.split("\n"):
        line = raw_line.strip()
        if not line:
            continue
        if _CLASSROOM_MANAGEMENT_RE.search(line) and len(line) <= 90:
            if _PLACEHOLDER_PREFIX in line:
                kept.append(_CLASSROOM_MANAGEMENT_RE.sub("", raw_line))
                continue
            continue
        kept.append(raw_line)
    return "\n".join(kept)


def _compress_punctuation(text: str) -> str:
    text = re.sub(r"([。！？；])\1+", r"\1", text)
    text = re.sub(r"[，,]\s*[，,]+", "，", text)
    text = re.sub(r"[、]\s*[、]+", "、", text)
    text = re.sub(r"\s+([，。！？；：、])", r"\1", text)
    return text


def _normalize_spacing(text: str) -> str:
    lines = []
    for line in text.split("\n"):
        line = re.sub(r"[ \t]+", " ", line).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def _review_flags(text: str) -> list[dict[str, str]]:
    flags: list[dict[str, str]] = []
    for pattern, reason in (
        (_SUSPICIOUS_ASR_RE, "疑似语文术语或转写错误，建议后续核对原文/讲义"),
        (_NOISE_RE, "疑似 ASR 噪声或乱码，建议人工复核"),
    ):
        for match in pattern.finditer(text):
            flags.append(
                {
                    "text": match.group(0),
                    "reason": reason,
                    "category": "transcript_suspect",
                    "severity": "low",
                    "status": "open",
                }
            )
    return _dedupe_flags(flags)


def _dedupe_flags(flags: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[tuple[str, str]] = set()
    deduped: list[dict[str, str]] = []
    for flag in flags:
        key = (flag["text"], flag["reason"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(flag)
    return deduped
