# OUTBOX · Codex · A2.1b 阅读导航补全

## 改动范围

- 功能代码只改 `apps/web/src/App.tsx` 和 `apps/web/src/styles.css`。
- 未改 `apps/api`、`textcore`、schemas、prompts、`docs/prototype/`。
- 未引入前端硬编码业务数据。
- 未提交 git。

## 只看段落标题 / 查看完整正文

- 详情页 sticky 控制栏右侧新增 `只看段落标题` / `查看完整正文` 按钮。
- 默认保持完整正文；点击后给阅读正文容器加 `compact-long`。
- 紧凑模式隐藏每个 `.long-section` 内除 `h2` 外的内容，并隐藏正文前的旁征博引块，确保正文区只保留分块标题。
- 紧凑模式下点击任一分块标题，会退出紧凑模式并平滑滚动定位到该分块。
- 该状态不改变四档正文 tab 的当前选中版本；切换 tab 后继续使用同一套真实 chunk 锚点。

## 段间导航

- 在 `anchoredHtmlFromBody()` 生成真实 chunk 锚点后，新增 `htmlWithChunkNavigation()` 对正文 HTML 做结构化增强。
- 每个已定位到的 chunk section 末尾注入一行：
  - `上一段`
  - `回到目录`
  - `下一段`
- 按钮不绑定硬编码课程数据，而是从 `buildChunkNavItems(course)` 得到的真实 `chunks[].chunk_id` 顺序生成。
- 点击逻辑通过阅读区事件委托处理：
  - `上一段` / `下一段` 调用现有 `jumpTo()`，平滑滚动并更新当前 chunk 高亮。
  - `回到目录` 平滑滚动到详情页课程摘要 / 顶部目录区域。
  - 首段的 `上一段` 和末段的 `下一段` 自动 disabled。
- 样式补齐 `.chunk-footer` / `.chunk-nav-button`，使用浅色圆角按钮和置灰禁用态，对齐 demo 的段间导航布局。

## 与 demo 仍存差异

- demo 的紧凑模式保留了部分 `chunk-meta`；本次按 A2.1b 验收要求处理为正文区只剩分块标题。
- `回到目录` 在当前 React 版中定位到课程摘要 / 顶部控制区，而不是 demo hash 版里的 `#chunkToc` 节点；视觉效果仍是回到首屏目录区域。
- 本步未做旁征博引浮层、复核 hover、资源联动、原文对照同步，按 INBOX 留给 A2.2/A2.3。

## 验证

- `cd apps/web && npm run check`：通过。
- `cd apps/web && npm run build`：通过。
- `cd apps/web && npm run dev`：未能启动浏览器视觉检查，当前沙箱拒绝 dev server 监听 `::1:5173`，报 `listen EPERM`。
