"""古文参考服务：原文用确定性检索锁定，释义旁征博引，错字只标不改。

分两层（见《古文诗词数据源与中文结构化 扩充研究 v0.2》）：
- 释义层 gushiwen：chinese-gushiwen，带 译文/注释/赏析。
- 全文校验层 guwen（殆知阁）：纯原文，未命中释义层时兜底（第一版可后接）。

入口：service.ClassicsService。
"""
from .service import ClassicsService, lookup_candidates

__all__ = ["ClassicsService", "lookup_candidates"]
