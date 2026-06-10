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
from textcore.pipeline.events import StatusEventBroker
from textcore.pipeline.runner import run_fake_pipeline
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
    assert len(provider.calls) == 5


def _mock_response(system: str, user: str) -> str:
    if "S4 分块保真清洗" in system:
        return _json(
            {
                "chunk_id": "c001",
                "cleaned_text": "老师讲《静夜思》，围绕月光和思乡理解诗意。",
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
    if "S7 四档版本生成" in system:
        return _json(
            {
                "faithful": {
                    "body_md": "## 《静夜思》\n老师讲月光像霜，并由此进入思乡情感。",
                    "compression": 0.9,
                    "char_count": 32,
                },
                "concise": {
                    "body_md": "## 课程摘要\n《静夜思》用月光意象表达思乡。",
                    "compression": 0.31,
                    "char_count": 24,
                },
                "study": {
                    "body_md": "- 意象：月光\n- 情感：思乡",
                    "compression": 0.09,
                    "char_count": 18,
                },
                "outline": {
                    "body_md": "- 《静夜思》：月光意象与思乡",
                    "compression": 0.05,
                    "char_count": 16,
                },
            }
        )
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
