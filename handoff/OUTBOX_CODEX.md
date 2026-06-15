# OUTBOX · Codex · A4 前端状态闭环

## 改动范围

- 只改 `apps/web/src/App.tsx` 与 `apps/web/src/styles.css`。
- 未改 `apps/api`、`textcore`、`schemas`、`prompts`、`docs/prototype`。
- 未提交 git。

## 状态呈现

- 刷新恢复：详情页继续从 URL `course_id` 调 `getCourse(courseId)` 拉取；同一课程手动刷新状态时保留当前可见详情，不先清空页面。
- `created` / `processing`：详情页显示“课程处理中”，导出按钮禁用；不渲染完成态正文、知识卡片和导出入口，改为处理进度、后端 `processing_log` 阶段列表、四档正文占位卡。
- `failed`：详情页显示“处理失败，暂不可导出”，导出按钮禁用；显示失败阶段/消息，提供“刷新状态”和“重新上传课稿”入口。
- 空态：课稿库/工作台仍使用真实 API 列表为空时的空面板，不造假数据。
- 正常态：`completed` / `needs_human` 继续显示 A1-A3 的正文版本、资源侧栏、复核抽屉和导出入口。

## 行为闭环

- SSE：上传成功后继续消费 `/events`，按事件 `progress` 或阶段推断进度；连接中断进入 `interrupted` 状态，显示“进度连接中断”，并刷新课稿库，不让进度条卡死。
- SSE 完成：收到完成事件后关闭连接、刷新列表，并自动跳转到新课程详情页。
- 导出：导出弹窗提交时按钮禁用并显示“生成中...”；成功触发下载，文件名使用课程名 + 版本名；失败显示错误提示并保留“重试生成”。
- 上一篇/下一篇：无可靠相邻上下文时已移除误导按钮，仅保留“返回课稿库”。
- 健壮性：长课程名、原始文件名、表格文本可换行；资源抽屉列表增加滚动上限，复核项很多时不会撑破抽屉。

## 主要组件变化

- `CourseDetail`：增加处理中轮询、非完成态分支、禁用导出文案、去掉上一篇/下一篇。
- 新增 `CourseStatusPanel`：承载 processing/failed 的版本占位、进度条、阶段列表和重试入口。
- `UploadPanel` / `ProgressPanel`：补进度 clamp、中断/失败/完成文案、同文件重选。
- `ExportModal`：接收课程标题并生成安全下载文件名。
- `CourseTable` / `App`：导出入口向弹窗传课程标题；上传 SSE 完成后自动导航。

## 验证

- `cd apps/web && npm run check`：通过。
- `cd apps/web && npm run build`：通过。
- `git diff --check -- apps/web/src/App.tsx apps/web/src/styles.css`：通过。

## 遗留

- in-app Browser smoke check未执行：本会话 Browser `iab` 不可用。已用 typecheck/lint/build 覆盖静态验证。
- 详情页处理中轮询依赖后端 `GET /api/courses/{id}` 返回最新状态；如果后台进度只存在内存 SSE 而未落库，刷新恢复仍以详情 API 的状态为准。
