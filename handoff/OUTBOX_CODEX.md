# OUTBOX · Codex · P4 S9 preferred/hard 区间

## 改动范围

- 修改 `textcore/pipeline/stages/s9_quality.py`。
- 修改 `tests/unit/test_s9_quality.py`。
- 更新 `tests/regression/test_course_state_invariants.py` 的四档 hard 区间常量。
- 未改 schema、前端、API 或其它 stage。
- 未提交 git。

## S9 改造点

- S9 不再用旧单一 `COMPRESSION_RANGES` 判断越界，改为调用 `check_version_ratio(...)` 的 preferred/hard 两档结果。
- 四档区间沿用 deterministic gate 默认值：
  - faithful：preferred 85-93%，hard 70-95%
  - concise：preferred 28-38%，hard 22-45%
  - study：preferred 8-12%，hard 5-15%
  - outline：preferred 4-7%，hard 3-10%
- ratio 计算口径：
  - 分子优先使用 version `char_count`；缺失时用 `body_md` 重新计算 visible char count。
  - 分母优先从 `chunk_results` 的 `source_char_count/source_chars/original_char_count/original_chars` 或 `original_text/current_chunk_original/chunk_original/source_text/raw_text` 计算。
  - 正式 state 当前不保留 S0 原文到 `chunk_results`，因此兼容回退为通过各 version 的 `char_count/compression` 估算同一个原文字数中位值，再用 `char_count / source_chars` 评估。
- preferred 内不写 `main_risks`。
- hard 内但偏离 preferred 写 `[warning] ...`，不触发 `recommended_human_review`。
- hard 外写 `[risk] ...`，并触发 `recommended_human_review=True`。
- 复核 flag 聚合、古文 diff/canonical_text 风险、coverage 判断保持原逻辑。
- `quality_score` 对 ratio finding 做轻量扣分：warning -3，risk -7；其它扣分逻辑保持原样。

## warning/risk 文案口径

- warning 示例：`[warning] 精简整理版占比 23%，低于理想区间(28-38%)但在可接受范围`
- risk 示例：`[risk] 保真清洗版占比 50%，低于硬底线(70-95%)，建议人工复核`
- 高于区间时同样使用 `高于理想区间(...)` / `高于硬底线(...)`。

## 测试

- 新增/调整 `tests/unit/test_s9_quality.py`：
  - 四档 char_count 全在 preferred：不出现 `[warning]` / `[risk]` ratio finding。
  - concise=23%：出现 warning 文案，且不强制 human review。
  - faithful=50%：出现 risk 文案，且 `recommended_human_review=True`。
  - 保留原有 review flag 聚合、古文 diff、coverage/canonical_text 风险覆盖。
- 更新 regression invariant 的 compression 常量到 hard 区间，匹配 P4 口径。

## 验证

- `.venv/bin/python -m pytest tests/unit/test_s9_quality.py tests/regression/test_course_state_invariants.py -q`：6 passed。
- `.venv/bin/python -m ruff check textcore/pipeline/stages/s9_quality.py tests/unit/test_s9_quality.py tests/regression/test_course_state_invariants.py`：通过。
- `make check`：通过。
  - 前端 typecheck/lint 通过。
  - `scripts/check_api.py` 通过。
  - 全量 pytest：39 passed，1 个既有 StarletteDeprecationWarning。
