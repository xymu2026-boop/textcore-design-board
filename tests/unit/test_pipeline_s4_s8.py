from __future__ import annotations

import asyncio
import io
import json
import zipfile
from datetime import UTC, datetime
from pathlib import Path

from textcore.classics.build_db import build_db
from textcore.classics.service import ClassicsService
from textcore.contracts.course_state import VERSION_KEYS, validate
from textcore.llm import LLMClient, MockProvider
from textcore.pipeline.deterministic.version_scaffold import text_char_count
from textcore.pipeline.events import StatusEventBroker
from textcore.pipeline.llm_stage import paragraph_text_for_chunk
from textcore.pipeline.runner import run_fake_pipeline
from textcore.pipeline.stages import s4_clean
from textcore.storage import CourseRepository

ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / "tests" / "fixtures" / "classics_seed"


def test_pipeline_s4_s8_with_mock_provider_and_classics_service(tmp_path: Path) -> None:
    repo = CourseRepository(tmp_path / "data")
    repo.migrate()
    course_id = "course_test_llm"
    source_path = _create_course(repo, course_id)

    db_path = tmp_path / "classics.sqlite"
    assert build_db(SEED, db_path) == 3
    classics_service = ClassicsService(db_path)

    provider = MockProvider(_mock_response)
    client = LLMClient(provider)
    asyncio.run(
        run_fake_pipeline(
            repository=repo,
            events=StatusEventBroker(),
            course_id=course_id,
            source_filename="sample.docx",
            source_path=source_path,
            llm_client=client,
            classics_service=classics_service,
        )
    )

    state = repo.get_state(course_id)
    validate(state)
    assert set(state["versions"]) == set(VERSION_KEYS)
    assert state["default_version"] == "concise"
    assert state["knowledge_cards"]
    assert state["writing_materials"]
    assert state["classics_refs"]
    assert state["classics_refs"][0]["matched"] is True
    assert state["classics_refs"][0]["source"] == "gushiwen"
    assert "明月" in state["classics_refs"][0]["canonical_text"]
    assert {call["stage"] for call in state["processing_log"]["model_calls"]} == {
        "S4",
        "S6",
        "S7",
        "S8",
    }
    assert len(provider.calls) == 5  # S4×1 + S6×1 + S7concise(逐块)×1 + S8×2
    assert _count_prompt_calls(provider, "S7 精简整理版生成") == len(state["chunk_results"])
    assert _count_prompt_calls(provider, "S7 学习整理版生成") == 0
    assert _count_prompt_calls(provider, "S7 四档版本生成") == 0


def test_s4_retries_once_when_cleaned_text_is_too_short() -> None:
    chunks, paragraphs = _s4_fixture()
    provider = MockProvider(
        _sequenced_responses(
            [
                _chunk_result("摘要。"),
                _chunk_result(_normal_s4_cleaned_text()),
            ]
        )
    )
    results, calls = s4_clean.run(
        chunks=chunks,
        paragraphs=paragraphs,
        llm_client=LLMClient(provider),
    )

    assert len(calls) == 2
    assert len(provider.calls) == 2
    assert "过度摘要" in provider.calls[1][1]
    assert results[0]["cleaned_text"] == _normal_s4_cleaned_text()
    assert not any(
        flag.get("flag_id", "").startswith("pipeline_fallback_")
        for flag in results[0].get("review_flags", [])
    )


def test_s4_falls_back_to_deterministic_faithful_scaffold_after_short_retry() -> None:
    chunks, paragraphs = _s4_fixture()
    provider = MockProvider(
        _sequenced_responses([_chunk_result("摘要。"), _chunk_result("太短。")])
    )

    results, calls = s4_clean.run(
        chunks=chunks,
        paragraphs=paragraphs,
        llm_client=LLMClient(provider),
    )

    result = results[0]
    original_chars = text_char_count(paragraph_text_for_chunk(chunks[0], paragraphs))
    cleaned_chars = text_char_count(result["cleaned_text"])
    fallback_flags = [
        flag
        for flag in result["review_flags"]
        if flag.get("flag_id", "").startswith("pipeline_fallback_")
    ]

    assert len(calls) == 2
    assert len(provider.calls) == 2
    assert cleaned_chars / original_chars >= 0.70
    assert "床前明月光，疑是地上霜。" in result["cleaned_text"]
    assert fallback_flags
    assert fallback_flags[0]["category"] == "other"
    assert fallback_flags[0]["text"] == "保真清洗兜底"
    assert "已回退确定性保真清洗" in fallback_flags[0]["reason"]


def test_s4_accepts_normal_length_cleaned_text_without_retry_or_fallback() -> None:
    chunks, paragraphs = _s4_fixture()
    provider = MockProvider(_sequenced_responses([_chunk_result(_normal_s4_cleaned_text())]))

    results, calls = s4_clean.run(
        chunks=chunks,
        paragraphs=paragraphs,
        llm_client=LLMClient(provider),
    )

    assert len(calls) == 1
    assert len(provider.calls) == 1
    assert results[0]["cleaned_text"] == _normal_s4_cleaned_text()
    assert results[0]["review_flags"] == []


def _mock_response(system: str, user: str) -> str:
    if "S4 分块保真清洗" in system:
        return _json(
            {
                "chunk_id": "c001",
                "cleaned_text": (
                    "今天讲李白的《静夜思》，先保留床前明月光、疑是地上霜这两句，"
                    "再围绕月光意象引出思乡情感，提醒学生结合意象理解诗意。"
                ),
                "key_points": ["月光意象引出思乡", "诗歌学习要结合意象和情感"],
                "student_answer_kept": [{"answer": "像霜。", "reason": "老师据此讲比喻"}],
                "review_flags": [],
                "entities": {
                    "persons": ["李白"],
                    "works": ["静夜思"],
                    "concepts": ["意象", "思乡"],
                },
                "classics_candidates": [
                    {
                        "title": "静夜思",
                        "writer": "李白",
                        "raw_span": "床前明月光，疑是地上霜。",
                        "kind": "poetry",
                        "confidence": 0.96,
                    }
                ],
            }
        )
    if "S6 全局合并" in system:
        return _json(
            {
                "course_summary": "本课围绕《静夜思》讲月光意象与思乡情感。",
                "outline_tree": [
                    {
                        "title": "一、《静夜思》的意象和情感",
                        "level": 2,
                        "anchor": "c001",
                        "chunk_ids": ["c001"],
                        "children": [],
                    }
                ],
                "main_themes": ["月光意象", "思乡"],
                "merged_review_flags": [],
            }
        )
    if "S7 精简整理版生成" in system:
        return _json({"body_md": "## 课程摘要\n《静夜思》用月光意象表达思乡。"})
    if "S7 学习整理版生成" in system:
        return _json({"body_md": "- 意象：月光\n- 情感：思乡"})
    if "S8 知识卡片抽取" in system:
        return _json(
            {
                "knowledge_cards": [
                    {
                        "card_id": "kc_001",
                        "title": "《静夜思》",
                        "type": "work",
                        "summary": "李白诗作，以月光引出思乡。",
                        "core_points": ["月光意象", "思乡情感"],
                        "related_persons": ["李白"],
                        "related_themes": ["思乡"],
                        "source_chunks": ["c001"],
                        "classics_ref_id": "ref_001",
                        "confidence": 0.9,
                    }
                ]
            }
        )
    if "S8 作文素材抽取" in system:
        return _json(
            {
                "writing_materials": [
                    {
                        "material_id": "wm_001",
                        "title": "月光与思乡",
                        "theme": ["乡愁", "亲情"],
                        "source": "《静夜思》课堂讲解",
                        "usable_expression": "月光照在床前，像霜一样把乡愁照亮。",
                        "teacher_comment": "用具体意象承载情感，比直接喊口号更有画面。",
                        "usage_suggestion": "适合写思乡、离别、亲情主题。",
                        "source_chunks": ["c001"],
                        "risk": "low",
                    }
                ]
            }
        )
    raise AssertionError(f"unexpected prompt: {system[:120]}\nuser={user[:120]}")


def _create_course(repo: CourseRepository, course_id: str) -> Path:
    source_path = repo.uploads_dir / course_id / "source.docx"
    source_path.parent.mkdir(parents=True, exist_ok=True)
    source_path.write_bytes(_docx_bytes())
    state_path = repo.processed_dir / course_id / "course_state.json"
    now = datetime.now(UTC).astimezone().isoformat(timespec="seconds")
    with repo._connect() as conn:
        conn.execute(
            """
            INSERT INTO courses (
                course_id, title, teacher, type, status, review_count,
                updated_at, created_at, state_path, source_path
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                course_id,
                "sample",
                None,
                None,
                "created",
                0,
                now,
                now,
                str(state_path.relative_to(repo.data_dir)),
                str(source_path.relative_to(repo.data_dir)),
            ),
        )
    return source_path


def _docx_bytes() -> bytes:
    document_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>今天讲李白的静夜思。</w:t></w:r></w:p>
    <w:p><w:r><w:t>床前明月光，疑是地上霜。</w:t></w:r></w:p>
    <w:p><w:r><w:t>老师说月光这个意象引出思乡。</w:t></w:r></w:p>
    <w:sectPr/>
  </w:body>
</w:document>
"""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as docx:
        docx.writestr(
            "[Content_Types].xml",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
""",
        )
        docx.writestr(
            "_rels/.rels",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>
""",
        )
        docx.writestr("word/document.xml", document_xml)
    return buffer.getvalue()


def _json(payload: dict[str, object]) -> str:
    return json.dumps(payload, ensure_ascii=False)


def _count_prompt_calls(provider: MockProvider, needle: str) -> int:
    return sum(1 for system, _user in provider.calls if needle in system)


def _s4_fixture() -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    paragraphs: list[dict[str, object]] = [
        {
            "pid": "p0001",
            "text": (
                "今天讲李白的静夜思。床前明月光，疑是地上霜。老师先让大家看月光像霜，"
                "再追问诗人为什么举头望明月、低头思故乡。这里不是背诵就结束，而是要把月光、"
                "动作和思乡情绪连起来理解。最后老师提醒，写阅读题时要说清意象如何承载情感。"
            ),
            "source_order": 1,
        }
    ]
    chunks: list[dict[str, object]] = [
        {
            "chunk_id": "c001",
            "paragraph_range": ["p0001", "p0001"],
            "primary_type": "poetry",
            "context_before": "",
            "must_preserve_spans": [
                {"text": "床前明月光，疑是地上霜。", "reason": "poetry"}
            ],
        }
    ]
    return chunks, paragraphs


def _normal_s4_cleaned_text() -> str:
    return (
        "今天讲李白的静夜思。床前明月光，疑是地上霜。老师先让大家看月光像霜，"
        "再追问诗人为什么举头望明月、低头思故乡。这里不是背诵就结束，而是要把月光、"
        "动作和思乡情绪连起来理解。"
    )


def _chunk_result(cleaned_text: str) -> str:
    return _json(
        {
            "chunk_id": "c001",
            "cleaned_text": cleaned_text,
            "key_points": ["月光意象引出思乡"],
            "student_answer_kept": [],
            "review_flags": [],
            "entities": {"persons": ["李白"], "works": ["静夜思"], "concepts": ["思乡"]},
            "classics_candidates": [],
        }
    )


def _sequenced_responses(responses: list[str]):
    remaining = list(responses)

    def handler(system: str, user: str) -> str:
        if "S4 分块保真清洗" not in system:
            raise AssertionError(f"unexpected prompt: {system[:120]}\nuser={user[:120]}")
        if not remaining:
            raise AssertionError("no mock response left")
        return remaining.pop(0)

    return handler
