# INBOX · Codex · T003 前端 demo 迁移为真实 React 应用

> 你是文心 TextCore 主力开发。本任务只做前端，**只碰 `apps/web/`**。
> 结果写 `handoff/OUTBOX_CODEX_WEB.md`，并在 `handoff/LOG.md` 追加一行。不提交 git。

## 目标
把现有高保真 demo（`docs/prototype/` 的 index.html / app.js / styles.css）迁移成 `apps/web` 下的真实 React + Vite + TS 应用，接后端 API。**视觉尽量贴近现有 demo。**

## 必读（仓库内）
- `docs/prototype/index.html`、`docs/prototype/app.js`、`docs/prototype/styles.css`（要迁移的 demo，**只读参考，不要改它**）
- `schemas/course_state.schema.json`（详情数据结构 = API `GET /api/courses/{id}` 返回）
- `schemas/api/course_list_item.schema.json`、`schemas/api/status_event.schema.json`（列表项、SSE 进度）
- `ai/decisions/ADR-004-version-tiers.md`（四档版本 key 与显示名映射）
- `00_产品设计/前端原型规范/`（页面结构与跳转）

## 范围
1. **路由**（React Router）：`/`工作台、`/courses`课稿库、`/courses/:id`课程详情、`/assets`知识资产。
2. **组件**：Topbar、UploadPanel、CourseTable、CourseDetail、VersionTabs、ChunkToc、ResourceDrawer（卡片/素材）、ClassicsPopover/ClassicsDrawer（古文旁征博引）、ReviewMark（复核标记）、ExportModal。
3. **版本档位映射**（ADR-004，写成一处常量表，便于改名）：
   - `faithful`→保真清洗、`concise`→精简整理(默认)、`study`→学习整理、`outline`→结构提纲。
   - 详情页默认打开 `default_version`（concise）。
4. **API client** `apps/web/src/api/`：对接 upload / list / detail / events(SSE) / export。基址 `http://127.0.0.1:8000`，可配。
5. **状态**：空状态 / 上传中处理中(消费 SSE 进度) / 完成 / 失败。
6. **旁征博引呈现**：详情页古文段落展示 canonical_text + translation + remark + shangxi + 来源；错字 diff 用低干扰标记（灰下划线/括注）。先按现有 demo 风格，留好数据接口。

## 不做
- 不碰 `apps/api/`、`textcore/`、`schemas/`、`docs/`、`00_产品设计/`、`素材/`。
- 不改 `docs/prototype/`（它是设计板，只读参考）。
- 不接真实 LLM；数据全部来自后端 API（后端假数据即可）。
- 不提交 git。

## 验收标准
- `cd apps/web && npm run check` 通过（tsc + lint）。
- `npm run dev` 起得来，四个路由可达，视觉接近现有线上 demo。
- 详情页：四档 tab 可切换、默认 concise、原文对照、知识卡片/作文素材抽屉、古文引用块、复核标记、导出弹窗都在。
- 列表页能渲染 `course_list_item`；上传后能看到处理中→完成的状态流转（接 SSE）。
- 页面刷新后能凭 course_id 恢复详情。

## 完成后
- `OUTBOX_CODEX_WEB.md` 写：做了什么、组件清单、路由、与 API 的对接点、npm run check 结果、与 demo 的视觉差异、遗留/需确认。
- `LOG.md` 追加：`[时间] CODEX: T003 前端迁移 完成`。
