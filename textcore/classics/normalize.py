"""文本归一化：匹配前去掉标点/空白/繁简差异，只保留可比字符。"""
from __future__ import annotations

import re

# 仅保留 CJK 统一表意文字（含扩展A）。标点、空格、数字、拉丁字母一律剔除。
_CJK = re.compile(r"[㐀-䶿一-鿿]")

try:  # OpenCC 可选：繁→简，装不上就跳过
    from opencc import OpenCC  # type: ignore

    _t2s = OpenCC("t2s")

    def _to_simplified(s: str) -> str:
        return _t2s.convert(s)
except Exception:  # pragma: no cover - 取决于本机是否装 opencc
    def _to_simplified(s: str) -> str:
        return s


def normalize(text: str) -> str:
    """返回只含简体 CJK 字符的串，用于原文比对。"""
    if not text:
        return ""
    text = _to_simplified(text)
    return "".join(_CJK.findall(text))
