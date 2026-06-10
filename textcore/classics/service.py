"""古文参考服务对外接口：S5 调用，把 S4 的 classics_candidates 变成 classics_refs。"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from .matcher import ClassicsMatcher, MatchResult

DEFAULT_DB = Path("data/classics/gushiwen.sqlite")


class ClassicsService:
    def __init__(self, db_path: str | Path = DEFAULT_DB):
        self.db_path = Path(db_path)
        self._matcher: ClassicsMatcher | None = None

    @property
    def available(self) -> bool:
        return self.db_path.exists()

    def _m(self) -> ClassicsMatcher:
        if self._matcher is None:
            self._matcher = ClassicsMatcher(self.db_path)
        return self._matcher

    def lookup_one(self, candidate: dict[str, Any]) -> dict[str, Any]:
        """单个候选 → classics_refs 元素（符合 course_state 的 classicsRef）。"""
        chunk_id = candidate.get("chunk_id", "")
        ref_id = candidate.get("ref_id", "")
        if not self.available:
            return _miss(chunk_id, ref_id)
        res: MatchResult = self._m().lookup(
            title=candidate.get("title", ""),
            writer=candidate.get("writer", ""),
            raw_span=candidate.get("raw_span", ""),
        )
        if not res.matched:
            return _miss(chunk_id, ref_id)
        out: dict[str, Any] = {
            "chunk_id": chunk_id,
            "matched": True,
            "source": res.source,
            "title": res.title,
            "writer": res.writer,
            "dynasty": res.dynasty,
            "canonical_text": res.canonical_text,
            "translation": res.translation,
            "remark": res.remark,
            "shangxi": res.shangxi,
            "confidence": res.confidence,
            "ref_url": res.ref_url,
            "diffs": [_diff_entry(d, candidate.get("pid")) for d in res.diffs],
        }
        if ref_id:
            out["ref_id"] = ref_id
        return out

    def lookup_candidates(self, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [self.lookup_one(c) for c in candidates]


def _miss(chunk_id: str, ref_id: str = "") -> dict[str, Any]:
    out = {"chunk_id": chunk_id, "matched": False, "source": "none"}
    if ref_id:
        out["ref_id"] = ref_id
    return out


def _diff_entry(d, pid: str | None) -> dict[str, Any]:
    entry = {"raw": d.raw, "canonical": d.canonical}
    if pid:
        entry["pid"] = pid
    return entry


def lookup_candidates(
    candidates: list[dict[str, Any]], db_path: str | Path = DEFAULT_DB
) -> list[dict[str, Any]]:
    return ClassicsService(db_path).lookup_candidates(candidates)
