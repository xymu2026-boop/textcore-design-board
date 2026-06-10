"""三级匹配 + 错字 diff。

1. 篇名(+作者) 精确匹配 —— 主路径，命中即拿全套释义。
2. 句子相似匹配 —— 只有原文片段时，归一化后在库里找最近原句。
3. 逐字 diff —— 命中后比对课稿片段与权威原文，产出错字复核标记。

设计原则：原文以库为准但**不静默替换**课稿，差异一律进 diffs 交人工/复核。
"""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path

from .normalize import normalize

# 句子相似匹配阈值：低于此不算命中，避免乱攀附。
SENTENCE_SIM_THRESHOLD = 0.62


@dataclass
class Diff:
    raw: str
    canonical: str


@dataclass
class MatchResult:
    matched: bool
    source: str = "none"  # gushiwen / guwen / none
    title: str = ""
    writer: str = ""
    dynasty: str = ""
    canonical_text: str = ""
    translation: str = ""
    remark: str = ""
    shangxi: str = ""
    ref_url: str = ""
    confidence: float = 0.0
    diffs: list[Diff] = field(default_factory=list)


def _ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _char_diffs(raw_norm: str, canon_norm: str) -> list[Diff]:
    """对两段归一化文本做逐字 diff，只取 replace 段（疑似错字）。"""
    diffs: list[Diff] = []
    sm = SequenceMatcher(None, raw_norm, canon_norm)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "replace":
            diffs.append(Diff(raw=raw_norm[i1:i2], canonical=canon_norm[j1:j2]))
    return diffs


class ClassicsMatcher:
    def __init__(self, db_path: str | Path):
        self.db_path = str(db_path)

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def lookup(self, title: str = "", writer: str = "", raw_span: str = "") -> MatchResult:
        conn = self._conn()
        try:
            row = self._tier1_title(conn, title, writer)
            tier = 1
            if row is None and raw_span:
                row, sim = self._tier2_sentence(conn, raw_span)
                tier = 2
                if row is None:
                    return MatchResult(matched=False)
                confidence = round(sim, 3)
            elif row is None:
                return MatchResult(matched=False)
            else:
                confidence = 0.95  # 篇名精确命中

            result = MatchResult(
                matched=True,
                source="gushiwen",
                title=row["title"],
                writer=row["writer"],
                dynasty=row["dynasty"],
                canonical_text=row["content"],
                translation=row["translation"],
                remark=row["remark"],
                shangxi=row["shangxi"],
                ref_url=row["ref_url"],
                confidence=confidence if tier == 2 else 0.95,
            )
            # 三级：错字 diff（有课稿片段才做）
            if raw_span:
                result.diffs = self._tier3_diff(raw_span, row["content"])
            return result
        finally:
            conn.close()

    def _tier1_title(self, conn, title: str, writer: str):
        tn = normalize(title)
        if not tn:
            return None
        if writer:
            cur = conn.execute(
                "SELECT * FROM works WHERE title_norm=? AND writer=? LIMIT 1", (tn, writer.strip())
            )
            row = cur.fetchone()
            if row:
                return row
        cur = conn.execute("SELECT * FROM works WHERE title_norm=? LIMIT 1", (tn,))
        return cur.fetchone()

    def _tier2_sentence(self, conn, raw_span: str):
        """用归一化片段在库里找最近原句。先用片段子串 LIKE 预筛，再用 ratio 排序。"""
        rn = normalize(raw_span)
        if len(rn) < 4:
            return None, 0.0
        best = None
        best_sim = 0.0
        # 预筛：取片段前若干字做 LIKE，缩小候选；命中不足再退化为按长度近似的全扫（库不大，可接受）
        probe = rn[: min(8, len(rn))]
        cur = conn.execute(
            "SELECT * FROM works WHERE content_norm LIKE ? LIMIT 200", (f"%{probe}%",)
        )
        rows = cur.fetchall()
        for row in rows:
            cn = row["content_norm"]
            if not cn:
                continue
            # 片段通常远短于全文，用"最佳匹配窗口"近似：直接整体 ratio + 子串包含加成
            sim = _ratio(rn, cn)
            if rn in cn:
                sim = max(sim, 0.9)
            if sim > best_sim:
                best_sim, best = sim, row
        if best is not None and best_sim >= SENTENCE_SIM_THRESHOLD:
            return best, best_sim
        return None, best_sim

    def _tier3_diff(self, raw_span: str, canonical_content: str) -> list[Diff]:
        rn = normalize(raw_span)
        cn = normalize(canonical_content)
        if not rn or not cn:
            return []
        # 在权威全文里定位与片段最相似的等长窗口，再做逐字 diff
        window = self._best_window(rn, cn)
        return _char_diffs(rn, window)

    @staticmethod
    def _best_window(rn: str, cn: str) -> str:
        if rn in cn:
            return rn  # 完全一致，无错字
        if len(cn) <= len(rn):
            return cn
        best_w = cn[: len(rn)]
        best_sim = _ratio(rn, best_w)
        step = max(1, len(rn) // 4)
        for start in range(0, len(cn) - len(rn) + 1, step):
            w = cn[start : start + len(rn)]
            s = _ratio(rn, w)
            if s > best_sim:
                best_sim, best_w = s, w
        return best_w
