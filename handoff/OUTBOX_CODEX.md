# OUTBOX · Codex · A2.3 资源联动 + 旁征博引浮层

## 改动范围

- 功能代码只改 `apps/web/src/App.tsx` 和 `apps/web/src/styles.css`。
- 未改 `apps/api`、`textcore`、schemas、prompts、`docs/prototype/`。
- 未引入硬编码业务数据；交互全部来自真实 API 字段。
- 未提交 git。

## 旁征博引浮层

- 在详情页正文 HTML 渲染后，用 `course.classics_refs[]` 自动扫描作品篇名和作者：
  - `title`
  - 去书名号后的 `title`
  - 带书名号的 `title`
  - 非“佚名”的 `writer`
- 匹配到的正文文本会被包成 `.classics-anchor` 按钮；课程摘要里的作品/作者标签也走同一浮层。
- 点击后打开锚点附近浮层，展示：
  - `canonical_text`
  - `translation`
  - `remark`
  - `shangxi`
  - `source` / `ref_url`
  - `matched=false` 时显示“未匹配权威原文”
- 浮层提供“展开详案”，进入右侧抽屉；有 `ref_url` 时同时显示“查看全文”外链。
- 详情页正文上方仍保留旁征博引卡片，使用首条 `classics_refs[0]`，不再只统计 matched 项。

## 复核标记微交互

- 正文 HTML 渲染后，用开放状态的 `review_flags[]` 自动扫描 `text`。
- 匹配文本会被包成灰色低干扰 `.review-inline` 标记：
  - 点线下划线
  - 括注式 `sup` 显示 `suggestion` 或“待复核”
  - hover/focus 小气泡展示 `reason` 和 `suggestion`
- 右侧“复核”tab 的列表项可点击定位：
  - 优先滚动到正文中对应 `data-review-index` 标记，并短暂高亮
  - 找不到正文具体标记时，回退到 `chunk_id`
  - 没有 `chunk_id` 时用 `pid` 反查 `chunks[].paragraph_range`

## 资源联动

- 右侧面板三 tab 改为真实切换：
  - 知识卡片：`knowledge_cards[]`
  - 作文素材：`writing_materials[]`
  - 复核：开放状态 `review_flags[]`
- 知识卡/素材点击打开抽屉详情。
- 知识卡和素材抽屉展示 `source_chunks`，并提供按 chunk 跳回正文的按钮。
- 资源列表卡片展示 `source_chunks` 的低干扰关联提示。
- 知识卡 tab 同时展示 `classics_refs[]` 的旁征博引资料入口。

## 空态处理

- `classics_refs` 为空：不显示旁征博引按钮/正文锚点，右侧知识卡 tab 只显示现有知识卡，完全为空时显示空态。
- `knowledge_cards` 为空：知识卡 tab 显示旁征博引资料或空态，不造假卡片。
- `writing_materials` 为空：素材 tab 显示“后端尚未返回作文素材”。
- `review_flags` 为空：复核 tab 显示“后端尚未返回待复核项”。
- `matched=false` 的 classics ref 不隐藏，明确显示“未匹配权威原文”。

## 与 demo 差异

- demo 的 `classicsRefs` 和复核文本是内置样例；React 版完全读取真实 `course_state` 字段。
- demo 浮层位置由原生 DOM 全局管理；React 版用组件状态记录锚点位置。
- 当前后端没有版本正文的结构化 token/span 坐标，正文标注采用前端文本匹配；若正文改写后不再包含 `review_flags[].text`，会自动回退到 chunk 定位。

## 验证

- `cd apps/web && npm run check`：通过。
- `cd apps/web && npm run build`：通过。
- 浏览器烟测：本会话沙箱拒绝 dev server 监听，`npm run dev -- --host 127.0.0.1` 报 `listen EPERM: operation not permitted 127.0.0.1:5173`，因此未能打开 localhost 做视觉烟测。
