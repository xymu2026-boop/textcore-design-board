# INBOX · Codex · ⑦ Word 导出精修

> 分支 `pipeline-fusion`。碰 `textcore/exporters/docx_export.py` + 测试 + (可选)`apps/web` 导出弹窗文案。**不动 schema、runner、流水线 stage、deterministic、classics、events**。**不提交 git**。结果写 OUTBOX，LOG 追加。

## 背景
Word 导出已能生成真实 docx(摘要+所选版本+卡片+素材+复核+古文)。本步精修排版与可读性，让妈妈打印/留档更好用。

## 范围（只动 exporters + 测试 + 可选前端弹窗文案）
1. **排版精修** `docx_export.py`：
   - 标题层级清晰(课程名→章节→小节)，字号/段距合理。
   - Markdown→docx：## /### 标题、- 列表、引用、加粗。
   - **古文块**：原文 / 译文 / 注释 / 赏析 / 来源 分层；原文用引用样式。
   - **复核标记**：灰色低干扰(不刺眼红)。
   - 摘要、四档(按勾选)、知识卡片、作文素材分节，节间留白。
   - printable(简洁可打印) vs archive(完整留档:多含复核明细/来源) 差异更明确。
2. **首页信息**：课程名、讲师、来源文件、生成说明(可选)。
3. (可选) `apps/web` 导出弹窗文案更清楚。

## 不做 / 边界
- 不改 schema、不动 runner/stage/deterministic/classics/events。
- 用 fixture/已有 course_state 测试，不依赖 data/processed 实时内容。不提交 git。

## 验收
- `make check` 全绿(导出单测：docx可重开、含预期章节、勾选项生效、两版式有别)。

## 完成后
- `OUTBOX_CODEX.md`：排版改动、古文块/复核样式、两版式差异、测试、make check 结果。
- `LOG.md` 追加：`[时间] CODEX: ⑦ Word导出精修 完成`。
