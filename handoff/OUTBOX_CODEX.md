# OUTBOX · Codex · P3 S7 scaffold + 兜底

## 改动范围

- 修改 `textcore/pipeline/stages/s7_versions.py`。
- 修改 `prompts/stages/s7_concise.system.md`。
- 新增 `tests/unit/test_s7_versions.py`。
- 更新 `tests/unit/test_pipeline_s4_s8.py` 的 S7 调用次数断言。
- 未改 schema、前端、API、S4/S5/S6/S8 或其它 stage。
- 未提交 git。

## S7 改造点

- 每个 chunk 先调用 P1 `build_chunk_scaffolds(...)` 生成 faithful/concise/study/outline 四档确定性基线。
- `faithful` 保持原逻辑：拼装 S4 `cleaned_text`，不调 LLM。
- `concise` 仍逐块调 LLM，但 user payload 新增：
  - `coverage_scaffold = scaf["concise"]["body_md"]`
  - `hard_min_chars = int(text_char_count(cleaned_text) * 0.25)`
- `concise` 比例门口径：
  - 逐块计算 `text_char_count(llm_body) / text_char_count(S4 cleaned_text)`。
  - 调 `check_version_ratio(version_key="concise", hard=(0.22, 0.45))`。
  - 兜底只保护低覆盖：低于 `hard_min_chars` 或低于 hard 下限 0.22 时，回退该块 `scaf["concise"]["body_md"]`。
  - 高于 hard 上限的 LLM 输出目前保留，避免很短 chunk 因标题字符触发回退。
- `study` 改为直接拼装各块 `scaf["study"]["body_md"]`，不再依赖 S4 `key_points`。
- `outline` 改为拼装各块 `scaf["outline"]["body_md"]`；当 S6 `outline_tree` 标题更丰富且合并后仍通过 outline ratio gate 时，合并 S6 标题。
- 四档最终 `char_count` / `compression` 仍由 S7 `_version` 从实际 `body_md` 计算，`compression` clamp 到 `<= 1`。

## 提示词

- `s7_concise.system.md` 已更新输入说明：加入 `coverage_scaffold`、`hard_min_chars`。
- 任务从自行摘要改为在 scaffold 覆盖范围上润色成段，并明确不得低于 `hard_min_chars`、不得漏掉 scaffold 主要讲解链条。
- `s7_study.system.md` 未改；S7 当前不再调用它。

## 调用次数

- S7 仍只对 concise 逐 chunk 调 LLM。
- study / outline 不调 LLM。
- 现有 S4-S8 mock 整链仍为 5 次 provider 调用：S4×1 + S6×1 + S7 concise×1 + S8×2。
- 新增断言：S7 concise 调用次数等于 `chunk_results` 数；S7 study prompt 和旧 S7 四档 prompt 调用次数为 0。

## 测试

- 新增 `test_s7_concise_falls_back_to_scaffold_when_llm_is_too_short`：
  - mock concise 返回过短。
  - 断言回退 `concise` scaffold。
  - 断言整篇 concise 占比 `>= 0.25`。
  - 断言 user payload 包含 `coverage_scaffold` 和 `hard_min_chars`。
- 新增 `test_s7_concise_keeps_normal_llm_result_without_fallback`：
  - mock concise 返回正常覆盖结果。
  - 断言使用 LLM body，不回退。
- 新增 `test_s7_study_and_outline_use_deterministic_scaffolds_with_target_ratios`：
  - 构造无 `key_points` chunk_results。
  - 断言四档非空。
  - 断言 study ratio 在 8%-12%，outline ratio 在 4%-7%。
  - 断言 study/旧四档 prompt 未调用。

## 验证

- `.venv/bin/python -m pytest tests/unit/test_s7_versions.py tests/integration/test_courses_api.py -q`：4 passed，1 个既有 StarletteDeprecationWarning。
- `.venv/bin/python -m ruff check textcore/pipeline/stages/s7_versions.py tests/unit/test_s7_versions.py tests/unit/test_pipeline_s4_s8.py tests/integration/test_courses_api.py`：通过。
- `make check`：通过。
  - 前端 typecheck/lint 通过。
  - `scripts/check_api.py` 通过。
  - 全量 pytest：36 passed，1 个既有 StarletteDeprecationWarning。

## 遗留

- S7 `run(...)` 当前没有 S3 原始 paragraph 文本输入；scaffold 的 `original_text` 会优先读 chunk_result 中可能存在的 `original_text/current_chunk_original/chunk_original/source_text/raw_text`，实际流水线里没有这些字段时退到 S4 `cleaned_text`。未改 runner，避免越过本任务边界。
