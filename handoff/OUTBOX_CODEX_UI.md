# OUTBOX · Codex · T007 前端高保真还原

## 完成范围

- 只修改了 `apps/web/src/App.tsx` 和 `apps/web/src/styles.css`。
- 工作台、课稿库、课程详情、知识资产继续使用现有 API 数据流与路由。
- 详情页按 `docs/prototype` 方向补齐了课程摘要卡、资源按钮、版本分段、章节目录、固定目录、右侧资源卡、抽屉资源面板、原文对照、古文旁征博引块、复核标记样式。
- 导出弹窗、抽屉、资产卡片、阅读正文排版和响应式布局增加了原型 CSS 设计语言覆盖层。

## CSS 移植方式

- 保留现有样式文件，在末尾增加 prototype fidelity layer，集中移植 `docs/prototype/styles.css` 中的颜色、间距、圆角、阴影、阅读正文、章节目录、资源按钮、弹窗、抽屉、古文引用块和复核标记样式。
- React 组件侧尽量对齐原型 className：`overview-card-head`、`overview-actions`、`resource-button`、`process-meta`、`chapter-menu`、`classical-appreciation-block`、`review-mark` 等。
- 未修改 `docs/prototype/`，仅只读参考。

## 与原型仍存差异

- React 版仍绑定真实后端数据，无法完全复刻原型内置样例的分段 id、快速滚动 rail、上一篇/下一篇等纯 demo 行为。
- 当前详情页保留右侧资源卡片栏，同时新增原型式资源按钮和抽屉面板；视觉更接近原型，但不是逐 DOM 复制。
- 当前执行环境无法启动 dev server 做截图验收：`npm run dev -- --host 127.0.0.1` 报 `listen EPERM: operation not permitted 127.0.0.1:5173`。Browser 插件也返回 `iab` 不可用。

## 验收结果

- `cd apps/web && npm run check`：通过。
- `cd apps/web && npm run build`：通过。
- 本地浏览器/dev server 渲染检查：受当前环境端口绑定和 Browser 实例不可用限制，未完成截图级验证。

## 遗留

- 建议 Claude Code 在可正常启动 Vite 的本机环境打开 `http://localhost:5173`，重点复核详情页宽屏/窄屏阅读区、右侧资源栏、章节目录下拉和抽屉宽度。
