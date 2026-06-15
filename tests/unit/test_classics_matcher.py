"""古文参考服务三级匹配 + 错字 diff 测试（用自包含 seed，不依赖全量库）。"""
from pathlib import Path

import pytest

from textcore.classics.build_db import build_db
from textcore.classics.service import ClassicsService

ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / "tests" / "fixtures" / "classics_seed"


@pytest.fixture(scope="module")
def service(tmp_path_factory):
    db = tmp_path_factory.mktemp("classics") / "seed.sqlite"
    n = build_db(SEED, db)
    assert n == 3
    return ClassicsService(db)


def test_tier1_title_hit_returns_full_glosses(service):
    r = service.lookup_one({"chunk_id": "c1", "title": "静夜思", "writer": "李白"})
    assert r["matched"] is True
    assert r["source"] == "gushiwen"
    assert "明月" in r["canonical_text"]
    assert r["translation"] and r["remark"] and r["shangxi"]
    assert r["confidence"] >= 0.9


def test_tier3_typo_diff(service):
    # 课稿把"天上来"误写成"天下来" → 应订正出 下→上
    r = service.lookup_one({
        "chunk_id": "c2", "title": "将进酒", "writer": "李白", "pid": "p10",
        "raw_span": "君不见黄河之水天下来奔流到海不复回",
    })
    assert r["matched"] is True
    assert any(d["raw"] == "下" and d["canonical"] == "上" for d in r["diffs"])
    assert all(d.get("pid") == "p10" for d in r["diffs"])


def test_tier2_sentence_only_match(service):
    # 只给原文片段、无篇名 → 句子相似命中
    r = service.lookup_one({"chunk_id": "c3", "raw_span": "予独爱莲之出淤泥而不染"})
    assert r["matched"] is True
    assert r["title"] == "爱莲说"


def test_miss_returns_unmatched(service):
    r = service.lookup_one(
        {"chunk_id": "c4", "title": "醉叟传", "writer": "袁宏道", "raw_span": "罪首者不知何地人"}
    )
    assert r["matched"] is False
    assert r["source"] == "none"


def test_no_db_graceful_miss(tmp_path):
    svc = ClassicsService(tmp_path / "nonexistent.sqlite")
    assert svc.available is False
    r = svc.lookup_one({"chunk_id": "c5", "title": "将进酒"})
    assert r["matched"] is False
