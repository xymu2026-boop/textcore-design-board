# INBOX · Codex · A1 清理假数据回退 + 补齐 API 错误态

> 前端收尾阶段第一步。**只碰 `apps/web/`**。结果写 `handoff/OUTBOX_CODEX.md`，`LOG.md` 追加一行。**不提交 git**（Claude 审查后统一提交）。
> 背景与全计划见 `00_产品设计/开发计划/TextCore_后续项目计划_v1.0_前端优先.md` 及你自己的审查 `handoff/CODEX_REVIEW_PLAN.md`。

## 要解决的问题
上一轮你自行加的 `apps/web/src/api/demo.ts` + `client.ts` 在 API 失败时**静默回退显示硬编码假课程**。这会误导验收、掩盖真实后端连接问题，违反"数据只来自真实 API"。本任务清除它，并把"API 失败"做成**明确、受控、可重试**的错误态。

## 范围（只动 apps/web）
1. **删除假数据回退**
   - 删除 `apps/web/src/api/demo.ts`。
   - `apps/web/src/api/client.ts` 去掉对 DEMO_COURSES 的 import 和所有 fallback 逻辑：API 失败就抛错/返回错误状态，**绝不返回假数据**。
2. **补齐 API 错误态（带重试按钮）**
   - 工作台：后端未连接 → 显示"无法连接后端服务"+重试。
   - 课稿库：列表请求失败 → "课程列表加载失败"+重试；空列表（无课程）→ 友好空态（区别于"失败"）。
   - 详情页：课程不存在(404) → "未找到该课程"；详情请求失败 → "加载失败"+重试。
   - 导出：导出失败 → 提示失败，可重试。
3. **处理中/失败状态**（把计划 A4 的错误/空态一起做）
   - 课程 status=processing：详情页或列表给"处理中"提示，相关按钮（导出等）禁用，不要显示"假完成"。
   - status=failed：明确显示"处理失败"。
   - SSE 进度中断：给可理解的提示，不卡死。
4. **真实 API 可用时体验不变**：后端正常时，列表/详情/上传/进度/导出照常工作。

## 不做 / 边界
- 不碰 `apps/api/`、`textcore/`、`schemas/`、`prompts/`、数据契约、`docs/prototype/`。
- 不引入任何前端硬编码业务数据；开发样例只能通过后端 seed / `data/processed` 经真实 API 进入。
- 若发现 API 缺字段，在 OUTBOX 写"需要后端补字段 XXX"，**不要**自己改后端/契约。
- 不提交 git。

## 验收标准
- `grep -r "DEMO_COURSES\|demo.ts" apps/web/src` 无业务数据回退残留。
- 后端关闭时：三个页面显示明确错误 + 重试按钮，**不显示任何假课程**。
- 后端开启时：6 篇真实课程、四档、详情正常渲染，体验不回退。
- 空列表、processing、failed 三种状态各有清晰呈现。
- `cd apps/web && npm run check` 通过；`npm run build` 通过。

## 完成后
- `OUTBOX_CODEX.md`：删了什么、各页面错误/空/处理中态如何呈现、是否发现缺字段、check/build 结果、遗留。
- `LOG.md` 追加：`[时间] CODEX: A1 清假数据回退+错误态 完成`。
