# OUTBOX · Codex · T003 前端 demo 迁移

## 做了什么

- 将 `apps/web` 从空 Vite 壳迁移为真实 React + TypeScript 应用。
- 按 demo 视觉迁移了纸感背景、朱砂红导航、上传面板、课程表格、长文阅读、版本切换、右侧资源栏、抽屉和导出弹窗。
- 实现 API client，前端数据读取、上传、SSE 进度、详情恢复、导出均走后端 API 契约。
- 新增四档版本常量表，集中维护 ADR-004 的 key 与显示名映射。

## 组件清单

- `Topbar`
- `UploadPanel`
- `CourseTable`
- `CourseDetail`
- `VersionTabs`
- `ChunkToc`
- `ResourceDrawer`
- `ClassicsPopover`
- `ClassicsDrawer`
- `ReviewMark`
- `ExportModal`

## 路由

- `/`：工作台
- `/courses`：课稿库
- `/courses/:id`：课程详情，刷新后按 URL 中的 `course_id` 重新请求详情
- `/assets`：知识资产

说明：当前环境无法新增 `react-router-dom` 依赖，因此实现为 History API 的轻量路由，路径形态与验收要求一致。

## API 对接点

基址：`VITE_API_BASE_URL` 可配，默认 `http://127.0.0.1:8000`。

- `GET /api/courses`：课程列表，兼容数组或 `{ courses }`
- `POST /api/courses/upload`：上传 Word，404 时 fallback 到 `POST /api/courses`
- `GET /api/courses/{id}`：课程详情 `CourseState`
- `GET /api/courses/{id}/events`：SSE 处理进度
- `POST /api/courses/{id}/export`：导出 Word blob

## 检查结果

- `cd apps/web && npm run check`：通过
- `cd apps/web && npm run build`：通过
- `npm run dev`：本沙箱监听端口失败，默认 `::1:5173` 和显式 `127.0.0.1:5173` 都返回 `listen EPERM`。这是当前运行权限限制，非 TypeScript/build 错误。

## 与 demo 的视觉差异

- 视觉基调、颜色、表格、上传区、阅读区、古文引用块和弹窗基本沿用 demo。
- 未引入 demo 的全部假数据和长文滚动小工具；页面内容以 API 返回为准。
- 知识资产页目前从课程列表提供入口，完整资产聚合需后端提供资产列表 API 后再补。

## 遗留 / 需确认

- 是否允许后续补 `react-router-dom` 依赖，以完全满足“React Router”字面要求。
- 后端最终上传路径若不是 `/api/courses/upload` 或 `/api/courses`，需同步调整 `apps/web/src/api/client.ts`。
- `versions.body_md` 当前支持 HTML 或简易 Markdown；如后端输出完整 Markdown，建议后续引入正式 Markdown 渲染器。
