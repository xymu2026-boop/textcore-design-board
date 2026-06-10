"""S1 deterministic pre-clean labels."""

from __future__ import annotations

import re
import unicodedata
from typing import Any

CLASSROOM_RE = re.compile(
    r"(安静|静一下|听得到|看屏幕|共享屏幕|谁来读|请.*读|请坐|上麦|下麦|开麦|"
    r"提交|上传|班级群|回去完成|作业)"
)
ROLL_CALL_RE = re.compile(r"(点名|抽查|抽一位|哪位同学|第一位|换一位|来了没|你来|请.*来)")
FILLER_RE = re.compile(r"(嗯|呃|啊|是吧|对吧|是不是|好吧|然后|这个|那个)", re.IGNORECASE)


def preclean(paragraphs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Mark removable/risky classroom noise without mutating S0 paragraph text."""

    return [_preclean_one(paragraph) for paragraph in paragraphs]


def normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text)
    normalized = re.sub(r"\s+", " ", normalized.replace("\u3000", " "))
    try:
        from opencc import OpenCC  # type: ignore[import-not-found]

        normalized = OpenCC("t2s").convert(normalized)
    except Exception:
        pass
    return normalized.strip()


def _preclean_one(paragraph: dict[str, Any]) -> dict[str, Any]:
    text = normalize_text(paragraph["text"])
    labels: list[str] = []
    risk: str | None = None

    if CLASSROOM_RE.search(text):
        labels.extend(["classroom_management", "delete_by_default"])
        risk = "low"
    if ROLL_CALL_RE.search(text):
        labels.append("roll_call")
        risk = risk or "low"
    if _is_filler_dense(text):
        labels.append("filler_dense")
        risk = risk or "medium"

    item: dict[str, Any] = {"pid": paragraph["pid"], "labels": labels}
    if risk:
        item["risk"] = risk
    return item


def _is_filler_dense(text: str) -> bool:
    if len(text) < 30:
        return False
    filler_chars = sum(len(match.group(0)) for match in FILLER_RE.finditer(text))
    return filler_chars / max(len(text), 1) >= 0.12
