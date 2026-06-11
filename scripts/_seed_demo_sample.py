"""把 demo 原型样本抽成 course_state 入库。
用法: python scripts/_seed_demo_sample.py <json_path> <course_id> <课程标题>
"""
import json
import re
import sys

from textcore.contracts.course_state import validate
from textcore.storage import CourseRepository

json_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/demo_zuisou.json"
course_id = sys.argv[2] if len(sys.argv) > 2 else "course_demo_zuisou"
title = sys.argv[3] if len(sys.argv) > 3 else "醉叟传 demo版"

demo = json.load(open(json_path, encoding="utf-8"))
raw_chars = demo["stats"]["rawChars"]


def text_len(html: str) -> int:
    return len(re.sub(r"<[^>]+>", "", html).replace("\n", "").replace(" ", ""))


def ver(html: str) -> dict:
    c = text_len(html)
    return {"body_md": html, "char_count": c, "compression": round(c / raw_chars, 2)}


vmap = {"faithful": "clean", "concise": "digest", "study": "study", "outline": "outline"}
versions = {k: ver(demo["versions"][s]) for k, s in vmap.items()}

review_flags = [
    {
        "flag_id": f"rf_{i + 1:03d}",
        "text": item[:40],
        "reason": item,
        "category": "transcription_error" if "醉叟" in item else "other",
        "severity": "medium",
        "status": "open",
    }
    for i, item in enumerate(demo["reviewItems"])
]

state = {
    "course_id": course_id,
    "schema_version": "1.0",
    "status": "completed",
    "source": {
        "file": demo["sourceFile"],
        "stored_path": "",
        "detected_meta": {
            "course_title": title,
            "teacher": "张老师",
            "student_group": "五上",
            "content_type_candidates": ["现代文阅读", "作文点评"],
        },
    },
    "course_types": {
        "types": [{"type": "modern_reading", "confidence": 0.6}],
        "dominant_type": "modern_reading",
        "mixed": True,
    },
    "versions": versions,
    "default_version": "concise",
    "global": {
        "course_summary": demo["subtitle"]
        + "（demo 原型 CodeX 规则化样本，保真清洗保留约 90%，作为优秀参考基准）",
        "main_themes": [],
        "merged_review_flags": [],
    },
    "knowledge_cards": [],
    "writing_materials": [],
    "classics_refs": [],
    "review_flags": review_flags,
    "quality": {
        "quality_score": 92,
        "coverage": "good",
        "main_risks": [],
        "recommended_human_review": True,
    },
    "processing_log": {"stages": [{"stage": "S0", "status": "done", "note": "demo 规则化样本"}]},
}

validate(state)
CourseRepository().save_state(state)
ratios = {k: f"{versions[k]['compression']:.0%}" for k in versions}
print(f"OK {title} 入库 {course_id} 四档保留率: {ratios}")
