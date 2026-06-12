# OUTBOX · Codex · A1 S4 保真确定性化 + 元数据

## 改动范围

- 修改 `textcore/pipeline/stages/s4_clean.py`。
- 新增 `prompts/stages/s4_extract.system.md`。
- 更新 `tests/unit/test_pipeline_s4_s8.py` 与 `tests/integration/test_courses_api.py` 的 S4 mock。
- 未改 schema、前端、S5-S10 或其它 stage。
- 未提交 git。

## S4 新数据流

- 每个 chunk 先用 `paragraph_text_for_chunk(chunk, paragraphs)` 取原文。
- 调用 `clean_transcript_text(original_text, preserve_spans=chunk.must_preserve_spans)` 生成保真版 `cleaned_text`。
- S4 LLM 调用改为只在已清洗文本 `current_chunk_cleaned` 上抽取小体量元数据：
  - `key_points`
  - `student_answer_kept`
  - `entities.persons/works/concepts`
  - `classics_candidates`
  - `review_flags`
- 最终 `chunkResult` 由 S4 代码组装：
  - `chunk_id` 来自 chunk。
  - `cleaned_text` 来自 deterministic transcript cleaner。
  - 元数据来自 LLM。
  - `review_flags` 合并 deterministic 候选与 LLM 输出。

## LLM 与提示词

- 新增 `prompts/stages/s4_extract.system.md`，明确“只抽元数据，不输出清洗文本/正文”。
- `classics_candidates.raw_span` 要求只从输入文本摘取，禁止凭记忆补全。
- `<PRESERVE>` 内容按原样识别，不改写、不纠错。
- S4 仍记录 stage `"S4"`，但本次元数据调用显式使用 `deepseek-v4-flash`。
- S4 内部新增元数据专用 JSON schema，避免要求 LLM 返回 `cleaned_text`，不修改冻结的 course_state schema。

## 删除的旧逻辑

- 删除 LLM 生成完整 `chunkResult.cleaned_text` 的流程。
- 删除保真比例门 `FAITHFUL_*_RATIO` 检查。
- 删除“过度摘要”重试。
- 删除 LLM 低于 70% 后回退 `build_chunk_scaffolds(...)` 的兜底逻辑。
- 保留 sanity gate：确定性 `cleaned_text` 为空时直接报错。

## Review Flags

- deterministic cleaner 返回的 `review_flags` 会并入 LLM 的 `review_flags`。
- S4 合并时补 `chunk_id`/`flag_id` 默认值，并把 deterministic 的非 schema 类别归一到合法 `transcription_error`，确保 `chunkResult` 仍能通过 schema 校验。
- 合并后按文本、建议、原因、类别去重。

## 测试

- `tests/unit/test_pipeline_s4_s8.py`
  - S4 mock 只返回元数据，不再返回 `cleaned_text`。
  - 断言 `cleaned_text` 等于 `clean_transcript_text(...)["text"]`。
  - 断言 cleaned/source 字数比在 70%-95%。
  - 断言单 chunk 只有 1 次 S4 LLM 调用，且模型为 `deepseek-v4-flash`。
  - 覆盖 deterministic + LLM `review_flags` 合并。
  - S4-S8 整链 mock 更新为 `S4 元数据抽取`，S4 调用次数等于 chunk 数。
- `tests/integration/test_courses_api.py`
  - API 集成测试的 S4 mock 同步为元数据形态，无 `cleaned_text` 字段。

## 验证

- `.venv/bin/python -m pytest tests/unit/test_pipeline_s4_s8.py -q`：3 passed。
- `make check`：通过。
  - 前端 typecheck/lint 通过。
  - `scripts/check_api.py` 通过。
  - 全量 pytest：38 passed，1 个既有 StarletteDeprecationWarning。
