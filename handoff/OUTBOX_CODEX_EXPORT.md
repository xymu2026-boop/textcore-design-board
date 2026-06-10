# OUTBOX · Codex · T006 质检 + Word 导出 + 回归

## S9 质量检查
- 新增 `textcore/pipeline/stages/s9_quality.py`，runner 的 S9 改为调用该模块。
- 覆盖检查：四档 `body_md` 非空；`outline_tree`/outline markdown 需体现层级。
- 压缩率检查：faithful 0.65-0.90、concise 0.25-0.45、study 0.05-0.15、outline 0.03-0.10；越界写入 `quality.main_risks`。
- 古文保护：matched ref 要求 `canonical_text` 非空；存在 `diffs` 时写风险，并生成 `classical_typo` 复核标记。
- 复核聚合：汇总 chunk/global/classics diff，去重后重排 `flag_id`。
- `recommended_human_review`：有 high 风险或古文 diff 时置 true。

## Word 导出
- 新增 `textcore/exporters/docx_export.py`，用 `python-docx` 生成真实 `.docx`。
- 支持 sections：`summary`、`faithful`、`concise`、`study`、`outline`、`cards`、`materials`、`review`、`classics`。
- 默认勾选：课程摘要 + concise + 知识卡片 + 作文素材 + 复核标记。
- 支持 `printable` / `archive` 版式；archive 额外写入质量留档信息。
- Markdown 转换覆盖标题、列表、引用、段落；引用块和复核标记使用灰色低干扰样式。
- `POST /api/courses/{id}/export` 接收 `{sections, format, version}`，无 body 时走默认导出。
- 前端导出弹窗改为四档版本可勾选，默认符合后端默认组合。

## 回归不变式
- 新增 `tests/regression/test_course_state_invariants.py`。
- fixture 优先使用 `data/processed/course_2026_652f24cc/course_state.json`，缺失时回退 `schemas/course_state.example.json`。
- 断言：`contracts.validate()`；四档正文非空且压缩率在区间；知识卡片/作文素材非空；古文 matched 项有 `canonical_text`；顶层 `review_flags` 有 `flag_id`；导出 docx 可重开并含预期章节。
- 新增 `make regression`，仅跑离线结构回归。
- 新增 `scripts/run_real_regression.py` 作为 Claude 手动真实 LLM 重跑入口，需 `DEEPSEEK_API_KEY`，不接入 CI/make check。

## 验证结果
- `make check`：通过，24 passed，1 个现有 Starlette/TestClient deprecation warning。
- `make regression`：通过，1 passed。
- 手测：用 `data/processed/course_2026_652f24cc/course_state.json` 导出 `data/exports/course_2026_652f24cc_codex_export.docx`，`python-docx` 重开成功；选择 `summary/concise/review` 时包含课程摘要、精简整理、复核标记，不包含保真清洗。

## 遗留
- 未真调 LLM，真实重跑留给 Claude 手动执行。
- 未修改 schema/contracts/llm/classics/prompts。
