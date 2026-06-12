# OUTBOX · Codex · P2 S4 比例门 + 重试 + 兜底

## 改动范围

- 修改 `textcore/pipeline/stages/s4_clean.py`。
- 修改 `tests/unit/test_pipeline_s4_s8.py`。
- 未改 schema、前端、API、S5-S10 或其它 stage。
- 未提交 git。

## S4 改造点

- 每个 chunk 先用 `paragraph_text_for_chunk(chunk, paragraphs)` 取原文，并用 deterministic `text_char_count` 计算 `original_chars`。
- LLM 正常返回 `chunkResult` 后，继续做既有 schema 校验和 chunk_id 校验。
- 新增 faithful 比例门：
  - 调 `check_version_ratio(version_key="faithful", preferred=(0.85, 0.93), hard=(0.70, 0.95))`。
  - 本次门禁只处理过度摘要风险：`ratio >= 0.70` 接受。
  - `ratio < 0.70` 追加提示重试一次：
    `你上次输出过度摘要（只剩 {ratio:.0%}）。保真清洗不是摘要，请逐句保留老师讲解，保留原文 70%-90%。`
- 重试仍低于 70% 时，调用 P1 deterministic `build_chunk_scaffolds(...)`，传入 `chunk_id/original_text/preserve_spans`，取 `faithful.body_md` 覆盖 `cleaned_text`。
- 兜底时向该 chunk 的 `review_flags` 追加 schema-valid 标记：
  - `flag_id`: `pipeline_fallback_{chunk_id}`
  - `text`: `保真清洗兜底`
  - `reason`: `S4 LLM 输出低于保真比例(<70%)，已回退确定性保真清洗`
  - `category`: `other`
  - `severity`: `medium`
  - `status`: `open`

## 调用次数

- 正常 faithful 比例达标：S4 每 chunk 仍 1 次 model_call。
- 首次低于 70%：S4 对该 chunk 记录 2 次 model_call。
- 兜底不额外记录 model_call，因为兜底是本地 deterministic scaffold。
- 现有 S4-S8 mock 整链仍为 5 次 provider 调用：S4×1 + S6×1 + S7 concise×1 + S8×2。

## 测试

- 新增 `test_s4_retries_once_when_cleaned_text_is_too_short`：
  - 第一次 mock 返回过短 `cleaned_text`。
  - 断言触发第二次 S4 调用，且 retry prompt 包含“过度摘要”。
  - 第二次返回正常长度后不兜底。
- 新增 `test_s4_falls_back_to_deterministic_faithful_scaffold_after_short_retry`：
  - 两次 mock 都过短。
  - 断言 fallback 后 `cleaned_text` 长度 >= 原文 70%。
  - 断言保留 span `床前明月光，疑是地上霜。` 仍存在。
  - 断言出现 `pipeline_fallback_` review_flag。
- 新增 `test_s4_accepts_normal_length_cleaned_text_without_retry_or_fallback`：
  - mock 返回正常长度。
  - 断言只调用 1 次且无兜底 flag。
- 更新原 S4-S8 mock 的 S4 `cleaned_text`，避免正常整链被误判为摘要。

## 验证

- `.venv/bin/python -m pytest tests/unit/test_pipeline_s4_s8.py -q`：4 passed。
- `make check`：通过。
  - 前端 typecheck/lint 通过。
  - `scripts/check_api.py` 通过。
  - 全量 pytest：33 passed，1 个既有 StarletteDeprecationWarning。

## 遗留

- S4 目前只对低于 70% 的过度摘要做重试/兜底；高于 hard upper 0.95 的偏长输出按任务要求仍接受。
