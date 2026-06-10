# INBOX · Codex · T007 前端高保真还原（对齐 docs/prototype）

> 你是文心 TextCore 主力开发。本任务只做前端视觉还原，**只碰 `apps/web/`**。
> 结果写 `handoff/OUTBOX_CODEX_UI.md`，`LOG.md` 追加一行。不提交 git。

## 背景
现有 React 应用（apps/web）功能能跑、接了 API，但**视觉还原度不够**：用户反馈"跟之前 demo 长得非常不一样、精致度差很多"，尤其详情页的长文阅读版式、间距、质感比原型简单。本任务把视觉拉回 demo 水准。

## 黄金参照（高保真目标，逐页对齐）
- `docs/prototype/index.html`：完整页面结构与 DOM
- `docs/prototype/styles.css`：**完整视觉设计的唯一真相**（配色、字号、间距、圆角、卡片、阅读版式、抽屉、弹窗、古文引用块、复核标记样式）
- `docs/prototype/app.js`：交互行为与各区块的 HTML 结构参考
- **只读参照，不要改 docs/prototype/**

## 目标
让 `apps/web` 渲染出的四个页面（工作台/课稿库/课程详情/知识资产）+ 抽屉/弹窗，视觉上**尽量接近 docs/prototype**。

## 做法（推荐）
1. **采用原型的 CSS 设计语言**：把 `docs/prototype/styles.css` 的设计 token、组件样式系统性移植进 `apps/web/src/styles.css`（可整体借用并按需适配 React 类名）。
2. **对齐 DOM 结构与 className**：调整各 React 组件的标记结构/类名，与原型对应区块一致，让样式正确命中。重点页面：
   - 工作台：上传卡片、处理进度步骤、最近处理表格的版式与质感。
   - 课稿库：表格行/筛选/状态徽标。
   - **课程详情页（重点）**：长文阅读排版（行距、字号、段距、最大宽度）、四档版本 tab 样式、原文对照、章节目录、右侧知识卡片/作文素材、**古文引用块**（原文+译文+注释+赏析的排版）、**复核标记**（灰色低干扰下划线/括注）。
   - 知识资产：卡片网格。
3. **保持数据接口不变**：不要破坏现有 API 调用（list/upload/detail/events/export）和四档 key 映射（faithful/concise/study/outline，默认 concise）。功能照常，只改观感。

## 不做
- 不碰 apps/api、textcore、schemas、prompts、docs/prototype（只读）、00_产品设计、素材。
- 不改数据流/接口契约。
- 不提交 git。

## 验收标准
- `cd apps/web && npm run check` 通过；`npm run build` 通过。
- 四个页面 + 详情页各区块视觉明显接近 docs/prototype（配色/间距/卡片/阅读版式/古文块/复核标记）。
- 现有功能不回退：列表加载、上传、SSE 进度、详情四档切换、抽屉、导出弹窗仍工作。
- dev server 下页面可正常渲染（用户会在 http://localhost:5173 实时刷新查看）。

## 完成后
- `OUTBOX_CODEX_UI.md`：还原了哪些页面/组件、CSS 移植方式、与原型仍存的差异、npm check/build 结果、遗留。
- `LOG.md` 追加：`[时间] CODEX: T007 前端高保真还原 完成`。
