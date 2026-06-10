"""把 chinese-gushiwen 的 NDJSON 导入 SQLite（释义层）。

源数据：chinese-gushiwen 的 guwen/*.json，每行一个对象，字段
title/dynasty/writer/content/remark/translation/shangxi/audioUrl。

用法：
    python -m textcore.classics.build_db \
        --src data/classics/gushiwen_src --db data/classics/gushiwen.sqlite
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

from .normalize import normalize

SCHEMA = """
CREATE TABLE IF NOT EXISTS works (
    id            INTEGER PRIMARY KEY,
    title         TEXT,
    title_norm    TEXT,
    writer        TEXT,
    dynasty       TEXT,
    content       TEXT,
    content_norm  TEXT,
    remark        TEXT,
    translation   TEXT,
    shangxi       TEXT,
    ref_url       TEXT
);
CREATE INDEX IF NOT EXISTS idx_works_title ON works(title_norm);
CREATE INDEX IF NOT EXISTS idx_works_writer ON works(writer);
"""

_GUSHIWEN_URL = "https://www.gushiwen.cn/"


def _iter_records(src: Path):
    for path in sorted(src.glob("*.json")):
        with path.open(encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    # 容错：极少数行可能损坏，跳过而非中断整库
                    continue


def build_db(src: Path, db_path: Path) -> int:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()
    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(SCHEMA)
        rows = []
        for rec in _iter_records(src):
            title = (rec.get("title") or "").strip()
            content = (rec.get("content") or "").strip()
            if not title and not content:
                continue
            rows.append((
                title,
                normalize(title),
                (rec.get("writer") or "").strip(),
                (rec.get("dynasty") or "").strip(),
                content,
                normalize(content),
                (rec.get("remark") or "").strip(),
                (rec.get("translation") or "").strip(),
                (rec.get("shangxi") or "").strip(),
                _GUSHIWEN_URL,
            ))
        conn.executemany(
            "INSERT INTO works (title,title_norm,writer,dynasty,content,"
            "content_norm,remark,translation,shangxi,ref_url)"
            " VALUES (?,?,?,?,?,?,?,?,?,?)",
            rows,
        )
        conn.commit()
        return len(rows)
    finally:
        conn.close()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="data/classics/gushiwen_src")
    ap.add_argument("--db", default="data/classics/gushiwen.sqlite")
    args = ap.parse_args()
    n = build_db(Path(args.src), Path(args.db))
    print(f"imported {n} works into {args.db}")


if __name__ == "__main__":
    main()
