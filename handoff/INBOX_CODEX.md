# INBOX · Codex · ② A4 前端状态闭环（只动 apps/web，与后台批处理并行）

> 分支 `pipeline-fusion`（已含前端 A1-A3）。**只碰 `apps/web/`**。不动 apps/api、textcore、schemas（后台正在跑批处理，勿碰流水线/数据）。**不提交 git**。结果写 `handoff/OUTBOX_CODEX.md`，`LOG.md` 追加一行。

## 背景
前端详情/列表/工作台/资产页已做（A1-A3）。本步补"状态闭环"，让前端在真实使用中各种状态都稳。先读现有 `apps/web/src/App.tsx` 评估已有覆盖，再补缺口。

## 范围（只动 apps/web）
1. **刷新恢复**：详情页刷新后能凭 URL 的 course_id 从 API 重新拉取，不丢状态（确认已有/补齐）。
2. **处理中/失败态**：
   - 课程 status=processing/created：详情页显示"处理中"，正文版本区给占位/进度，导出等按钮禁用，不显示"假完成"。
   - status=failed：明确显示"处理失败"，给重试入口（重新上传/重处理提示）。
3. **SSE 进度**：上传后进度条消费 SSE；连接中断显示可理解提示（"进度连接中断"），不卡死；完成后自动跳到课程。
4. **导出体验**：导出中(禁用按钮+loading)、成功(下载，文件名含课程名)、失败(提示+重试)。
5. **上一篇/下一篇**：若无可靠相邻上下文，弱化为"返回课稿库"，避免误导性跳转。
6. **健壮性细节**：长标题折行不撑破；复核项很多时抽屉可滚动不崩。

## 不做 / 边界
- 不碰 apps/api、textcore、schemas、prompts、docs/prototype（只读参照）。
- 不引入硬编码业务数据（数据只来自真实 API）。不提交 git。

## 验收
- `cd apps/web && npm run check` + `npm run build` 通过。
- processing/failed/空/正常 四态详情页各有合理呈现；导出三态；刷新恢复；SSE 中断有提示。

## 完成后
- `OUTBOX_CODEX.md`：各状态如何呈现、改了哪些组件、与之前的差异、check/build 结果、遗留。
- `LOG.md` 追加：`[时间] CODEX: A4 前端状态闭环 完成`。
