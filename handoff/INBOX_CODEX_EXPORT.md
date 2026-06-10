# INBOX · Codex · T006 质量检查 + 真实 Word 导出 + 回归

> 你是文心 TextCore 主力开发。本任务做 S9 质检增强、真实 Word 导出、回归套件。
> 碰 `textcore/exporters/`、`textcore/pipeline/stages/`(S9)、`apps/api/main.py`(export 端点)、`tests/`、`apps/web/`(导出弹窗传参，可选)。
> 不碰 `schemas/`、`textcore/contracts/`、`textcore/llm/`、`textcore/classics/`、`prompts/`。
> **沙箱无网络：不真调 LLM。** 用已有真实产物 `data/processed/course_2026_652f24cc/course_state.json` 或 `schemas/course_state.example.json` 作 fixture。
> 结果写 `handoff/OUTBOX_CODEX_EXPORT.md`，`LOG.md` 追加一行。不提交 git。

## 范围
### A. S9 质量检查增强 `textcore/pipeline/stages/s9_quality.py`（或现有 S9 处）
确定性检查，产出 course_state.quality（符合 $defs/quality：quality_score/coverage/main_risks/recommended_human_review）：
- 覆盖率：各档非空、outline 有层级。
- 压缩率合理性：faithful≈0.65-0.9 / concise≈0.25-0.45 / study≈0.05-0.15 / outline≈0.03-0.1，越界进 main_risks。
- 古文保护：classics_refs 里 matched 的项，canonical_text 非空；有 diffs 的进 main_risks 提示人工核对。
- 复核标记聚合：汇总 chunk_results + global + classics diffs 到顶层 review_flags（去重，带 flag_id）。
- recommended_human_review：有 high 风险或文言文 diff 时置 true。

### B. 真实 Word 导出 `textcore/exporters/docx_export.py`
用 `python-docx` 生成真实可打印 Word（替换现在的占位 zip）：
- 入参：course_state + 勾选项 selection（哪些 section）+ 版式 format(简洁可打印/完整留档)。
- 章节：课程摘要、所选版本(faithful/concise/study/outline 按勾选)、知识卡片、作文素材、复核标记、(可选)古文原文+译文+注释+赏析。
- 标题层级、引用块、复核标记用灰色低干扰样式。body_md 做基本 Markdown→docx 段落转换(标题/列表/段落即可)。
- 默认勾选：课程摘要 + concise + 知识卡片 + 作文素材 + 复核标记。
- 改 `apps/api/main.py` 的 `POST /api/courses/{id}/export`：接收 JSON body {sections:[...], format:"..."}，调 exporter 返回真实 docx。无 body 时用默认勾选。
- (可选) `apps/web` 导出弹窗把勾选项/版式发给后端。

### C. 回归套件 `tests/regression/`
- 因真实 LLM 非确定性，回归只断言**结构不变式**，不比对原文：
  - course_state 经 contracts.validate()
  - 四档版本都非空、压缩率落在区间
  - knowledge_cards/writing_materials 非空
  - classics_refs 存在且 matched 项有 canonical_text
  - review_flags 有 flag_id
- 提供 `make regression`：对一个 fixture course_state（用上面真实产物快照）跑 S9 + 导出 + 不变式断言；不需要联网。
- 同时保留一个"真实重跑"脚本入口(需 key，标注由 Claude 手动跑)，但 CI/make check 不依赖它。

## 不做
- 不真调 LLM、不联网。
- 不碰 schemas/contracts/llm/classics/prompts。
- 不提交 git。

## 验收标准
- `make check` 全绿；新增导出单测(生成的 .docx 能被 python-docx 重新打开、含预期标题)、S9 质检单测、回归不变式测试。
- `make regression` 跑通。
- 手测：对 fixture 调导出生成真实 docx，章节/勾选生效。

## 完成后
- `OUTBOX_CODEX_EXPORT.md`：S9 检查项、导出章节与样式、回归不变式清单、make check/regression 结果、遗留。
- `LOG.md` 追加：`[时间] CODEX: T006 质检+导出+回归 完成`。
