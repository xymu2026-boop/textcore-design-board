# OUTBOX · Codex · ⑦ Word 导出精修

## 改动范围

- 修改 `textcore/exporters/docx_export.py`。
- 修改 `tests/unit/test_docx_export.py`。
- 未修改 schema、runner、流水线 stage、deterministic、classics、events。
- 未提交 git。

## 排版改动

- 新增首页信息：课程名、讲师、来源文件、导出用途、生成说明；archive 额外包含课程 ID 和导入时间。
- 统一配置 Word 标题样式：
  - 课程名使用 Title。
  - 课程摘要、四档版本、知识卡片、作文素材、复核标记、古文资料使用 Heading 1。
  - 版本正文与卡片/素材/古文内部层级使用 Heading 2/3。
- 调整 Normal、Heading、引用、低干扰信息、来源、复核标记的字号、段前段后和行距，章节之间增加留白。
- Markdown 渲染增强：
  - 支持 `##` / `###` 标题映射为 Word Heading 2/3。
  - 支持 `-` / `*` 列表、数字列表、`>` 引用。
  - 支持 `**加粗**`、`*斜体*`、反引号 code 的 inline run。
  - 顺手兼容简单 `<h*>` / `<p>` / `<strong>` 标记，避免导出中露出基础 HTML 标签。

## 古文块与复核样式

- 古文资料按 `原文 / 译文 / 注释 / 赏析 / 来源` 分层输出。
- 原文段落使用 `TC Quote` 引用样式；译文、注释、赏析使用普通正文层级。
- 来源块在 printable 中保持简洁，只列资料库/朝代；archive 中增加链接、引用 ID、分块、置信度。
- archive 对古文 diff 增加 `复核差异` 小节。
- 复核标记改为 `TC Review Flag` 灰色样式 `RGB(104,104,104)`，不使用醒目的红色。

## 两版式差异

- printable：适合打印，保留简洁首页、所选章节、简短复核说明、简短古文来源。
- archive：完整留档，首页增加课程 ID/导入时间，复核标记包含类别/状态/段落/分块/原因，古文来源包含链接/引用 ID/置信度，并保留 `留档信息` 页面。

## 测试

- 扩展 `tests/unit/test_docx_export.py`：
  - docx 可重开并含首页信息与所选章节。
  - 勾选版本/古文生效，未勾选章节不输出。
  - Markdown 标题、列表、引用、加粗 run 生效。
  - 古文原文使用引用样式，译文不使用引用样式。
  - printable/archive 文本内容有明确差异，复核样式为灰色。

## 验证

- `.venv/bin/python -m ruff check textcore/exporters/docx_export.py tests/unit/test_docx_export.py`：通过。
- `.venv/bin/python -m pytest tests/unit/test_docx_export.py -q`：5 passed。
- `make check`：通过。
  - web typecheck/lint：通过。
  - `scripts/check_api.py`：通过。
  - pytest：53 passed，1 个既有 `StarletteDeprecationWarning`。
