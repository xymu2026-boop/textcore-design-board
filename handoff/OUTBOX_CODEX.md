# OUTBOX · Codex · A2.1 详情页三栏骨架

## 改动范围

- 只改 `apps/web/src/App.tsx` 和 `apps/web/src/styles.css`。
- 未改 API、schemas、prompts、`docs/prototype/`。
- 未引入前端硬编码业务数据。

## 三栏结构

- 详情页主体恢复为三栏 grid：
  - 左栏：常驻 C 段导航 `ChunkToc`。
  - 中栏：课程摘要、版本切换、正文阅读区。
  - 右栏：知识卡片 / 作文素材 / 复核资源入口与容器。
- `detail-page-container` 调整为 `min(1480px, calc(100% - 48px))`，桌面端给三栏留出稳定宽度。
- 1180px 以下收窄三栏，1050px 以下退化为单列，避免移动端挤压。

## 章节导航

- 左栏每项显示：
  - C 编号：由真实 `chunks[].chunk_id` 格式化。
  - 标题：优先从 `global.outline_tree[].chunk_ids` 匹配，否则使用 `primary_type` 标签。
  - 段落范围/字数：来自 `chunks[].paragraph_range` + `paragraphs[]`，缺失时用 API 版本统计估算。
- 点击左栏项会滚动到正文对应锚点，并立即高亮当前项。
- 增加 `IntersectionObserver`，根据当前可见 `.long-section[id]` / `.outline-chunk[id]` 更新左栏和顶部辅助下拉高亮。
- 为真实 API 正文补锚点：
  - 如果 `body_md` 已带 chunk id，只补 `.long-section` / `.outline-chunk` class。
  - 如果没有 id，则按正文 `h2`、outline `li` 或块状内容顺序补齐 chunk id。

## 阅读版式参数

- 正文区 `max-width: 760px`。
- 正文字号 `18px`，行高 `1.95`。
- `h2` 约 `30px / 1.35`，段间距约 `21px`。
- `.long-section` 增加段落分隔、`scroll-margin-top: 150px`，匹配 sticky 工具栏下的定位需求。

## 标题区与真实字段

- 标题格式改为：`课程：{课程名} ｜ 讲师：{讲师}`。
- 课程名、讲师、课型、原始文件、状态、段落数、处理块数均来自 API 字段。
- 副标题行使用 `detected_meta.student_group` / `detected_meta.date`，没有字段则不显示。
- 标题区新增四档字数比例摘要：
  - `versions[faithful|concise|study|outline].char_count`
  - 优先显示 API `versions.*.compression`，缺失时才回退到 `char_count / rawChars`。
- 长标题增加 `overflow-wrap: anywhere` 和 `word-break: break-word`，避免撑破首屏。

## 与 demo 仍存差异

- 本步未做旁征博引浮层、复核 hover 气泡、资源联动、原文对照同步，按 INBOX 留给 A2.2/A2.3。
- 右侧资源区保留现有列表/抽屉入口，没有做按当前 chunk 的资源计数联动。
- 浏览器视觉验证未执行：当前沙箱拒绝 dev server 监听 `127.0.0.1:5173`，报错 `listen EPERM`。

## 验证

- `cd apps/web && npm run check`：通过。
- `cd apps/web && npm run build`：通过。

## 遗留

- 如真实课程的 `body_md` 未来稳定输出 chunk id，当前前端补锚逻辑仍兼容；如后端输出完全无结构长文本，前端会按内容块顺序补锚，定位粒度会低于 demo。
- 未提交 git，按要求等待 Claude 审查后统一提交。
