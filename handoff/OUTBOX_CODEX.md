# OUTBOX · Codex · A1 清理假数据回退 + API 错误态

## 改动范围

- 删除 `apps/web/src/api/demo.ts`。
- 更新 `apps/web/src/api/client.ts`：移除 `DEMO_COURSES` import、列表/详情 fallback、`toCourseListItem` 假数据转换；API 失败现在直接抛出真实错误。
- 更新 `apps/web/src/App.tsx` 和 `apps/web/src/styles.css`：补齐工作台、课稿库、详情页、导出、SSE 中断、processing/failed 状态 UI。

## 页面状态

- 工作台：
  - 后端列表请求失败显示「无法连接后端服务」和「重试连接」按钮。
  - 空列表显示「还没有课稿」，不再把 API 不可用混为空态。
- 课稿库：
  - 列表请求失败显示「课程列表加载失败」和「重试」按钮。
  - 后端返回空数组时显示友好空态。
  - 筛选无结果显示「没有匹配结果」。
- 详情页：
  - 404 显示「未找到该课程」，按钮返回课稿库。
  - 非 404 失败显示「加载失败」和「重试」按钮。
  - `created` / `processing` 显示「课程处理中」，不渲染正文版本区，导出禁用。
  - `failed` 显示「处理失败」，导出禁用。
- 导出：
  - 导出请求失败显示「导出失败，请重试」。
  - 失败后主按钮变为「重试生成」。
  - 生成中禁用重复提交。
- SSE：
  - 进度连接中断时追加「进度连接中断」失败事件，状态显示「进度连接中断」，并触发一次列表刷新，不再保持无解释的处理中卡住状态。

## 后端字段

- 未发现必须补齐的新字段。

## 验证

- `grep -r "DEMO_COURSES\|demo.ts" apps/web/src`：无输出。
- `cd apps/web && npm run check`：通过。
- `cd apps/web && npm run build`：通过。
- `git diff --check -- apps/web/src/App.tsx apps/web/src/api/client.ts apps/web/src/api/demo.ts apps/web/src/styles.css`：通过。

## 未完成 / 遗留

- 未提交 git，按要求等待 Claude 审查后统一提交。
- 浏览器验证未执行：沙箱拒绝本地前端服务监听 `127.0.0.1:5173`，报错 `listen EPERM`。
