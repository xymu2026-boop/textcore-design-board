"""S2 deterministic topic segmentation.

This is a rule-based mock with the same public interface expected from the
future lightweight LLM segmenter. It never calls the network.
"""

from __future__ import annotations

import re
from typing import Any

SEGMENT_TYPES = {"讲解", "题目", "学生回答", "作文点评", "文言文原文", "古诗词", "课堂管理", "闲聊"}

CLASSROOM_RE = re.compile(
    r"(安静|静一下|看屏幕|共享屏幕|开麦|上麦|下麦|提交|上传|班级群|谁来读|请坐)"
)
QUESTION_RE = re.compile(
    r"(第[一二三四五六七八九十\d]+[题问]|题目|选择题|赏析|概括|划线句|答案|答题|"
    r"阅读理解|问你|怎么答|为什么)"
)
ESSAY_RE = re.compile(r"(作文|习作|立意|开头|结尾|素材|详略|描写|议论|点评)")
POETRY_RE = re.compile(r"(古诗|诗词|诗歌|意象|李白|杜甫|王维|夜上受降城|闻笛|芦管|望乡)")
BOUNDARY_RE = re.compile(
    r"^(好|那么|接下来|首先|然后|最后|我们来看|我们一块|这里|第[一二三四五六七八九十\d]+|"
    r"这一讲|下一讲|标题|进入|回到)"
)

CLASSICAL_OPEN_RE = re.compile(
    r"^[\u4e00-\u9fff，、：「」；：]{0,6}"
    r".{0,36}(者|曰|之|其|以|乃|亦|遂|无|吾|夫|若|则|于|矣|焉|耳|乎|也)"
)
CLASSICAL_MARKERS = (
    "者",
    "曰",
    "之",
    "其",
    "以",
    "乃",
    "亦",
    "遂",
    "无",
    "吾",
    "夫",
    "则",
    "于",
    "矣",
    "焉",
    "耳",
    "乎",
    "也",
    "不知何地人",
    "呼曰",
    "望之",
    "问之",
)
CLASSICAL_STRONG_MARKERS = (
    "者",
    "曰",
    "乃",
    "亦",
    "遂",
    "吾",
    "夫",
    "则",
    "矣",
    "焉",
    "乎",
    "不知",
    "呼曰",
    "望之",
    "问之",
)
CLASSICAL_START_RE = re.compile(
    r"^(最叟者|醉叟者|罪首者|望之|意游行时|遂[一意]|冠.{1,16}，|"
    r"无伴侣|人有.{0,8}者)"
)
MODERN_START_RE = re.compile(r"^(呃|啊|好|然后|但是|所以|那么|我们|通过|它|他|这里|古代|偷)")
POEM_LINE_RE = re.compile(r"(回乐峰前沙似雪|受降城外月如霜|不知何处吹芦管|一夜征人尽望乡)")


def segment(paragraphs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return S2 segment annotations for S0 paragraphs."""

    segments: list[dict[str, Any]] = []
    previous_type: str | None = None
    previous_speaker: str | None = None

    for index, paragraph in enumerate(paragraphs):
        segment_type = classify_segment_type(paragraph)
        speaker = paragraph.get("speaker")
        is_boundary = (
            index == 0
            or segment_type != previous_type
            or (bool(speaker) and bool(previous_speaker) and speaker != previous_speaker)
            or bool(BOUNDARY_RE.search(paragraph["text"]))
        )
        segments.append(
            {
                "pid": paragraph["pid"],
                "segment_type": segment_type,
                "is_boundary": is_boundary,
            }
        )
        previous_type = segment_type
        previous_speaker = speaker or previous_speaker

    return segments


def classify_segment_type(paragraph: dict[str, Any]) -> str:
    text = paragraph["text"]
    speaker = str(paragraph.get("speaker") or "")

    if CLASSROOM_RE.search(text) and len(text) < 180:
        return "课堂管理"
    if _looks_like_student_answer(speaker, text):
        return "学生回答"
    if _looks_like_classical_original(text):
        return "文言文原文"
    if _looks_like_poetry(text):
        return "古诗词"
    if ESSAY_RE.search(text):
        return "作文点评"
    if QUESTION_RE.search(text):
        return "题目"
    if _looks_like_chitchat(text):
        return "闲聊"
    return "讲解"


def _looks_like_student_answer(speaker: str, text: str) -> bool:
    if speaker and not re.search(r"(老师|陈细影|教师|讲师)", speaker):
        return True
    return len(text) < 80 and re.search(r"^(嗯|对|不是|因为|我觉得|应该|不知道)", text) is not None


def _looks_like_classical_original(text: str) -> bool:
    prefix = text[:80]
    if CLASSICAL_START_RE.search(prefix):
        return True
    if MODERN_START_RE.search(prefix[:12]):
        return False
    strong_count = sum(prefix.count(marker) for marker in CLASSICAL_STRONG_MARKERS)
    marker_count = sum(prefix.count(marker) for marker in CLASSICAL_MARKERS)
    return bool(CLASSICAL_OPEN_RE.search(prefix) and strong_count >= 2 and marker_count >= 4)


def _looks_like_poetry(text: str) -> bool:
    if POEM_LINE_RE.search(text):
        return True
    if text.startswith(("回乐峰", "受降城", "不知何处", "一夜征人")):
        return True
    if not POETRY_RE.search(text) or MODERN_START_RE.search(text[:12]):
        return False
    clauses = re.split(r"[，。！？；、\s]+", text[:120])
    short_lines = [clause for clause in clauses if 4 <= len(clause) <= 9]
    return len(short_lines) >= 4 and any(keyword in text[:120] for keyword in ("月", "笛", "乡"))


def _looks_like_chitchat(text: str) -> bool:
    return len(text) < 120 and re.search(r"(哈哈|呵呵|开玩笑|闲聊|没关系)", text) is not None
