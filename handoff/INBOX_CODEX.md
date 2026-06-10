# INBOX · 给 Codex CLI 的任务

> 你是文心 TextCore 项目的主力开发（gpt-5.5 / 高推理）。这是当前任务。
> 一切走文件：实现完成后把结果写进 `handoff/OUTBOX_CODEX.md`，并在 `handoff/LOG.md` 追加一行。

## 任务 T001 · Phase 0 工程脚手架 + AI 协作控制台

### 目标
把这个目前只有设计文档的仓库，初始化成一个可运行、可协作的 monorepo 工程骨架。
**只搭骨架和占位，不实现业务逻辑。**

### 必读背景（仓库内）
- `00_产品设计/开发计划/TextCore_正式开发框架与AI协作计划_v0.1.md`（§3.2 工程目录、§4 Phase 0、§7 纪律）
- `ai/decisions/ADR-001-tech-stack.md`（技术栈）
- `ai/decisions/ADR-004-version-tiers.md`（四档版本，代码用英文 key：faithful/concise/study/outline）

### 范围（要创建的东西）
1. 工程目录骨架（按开发计划 §3.2）：
   - `apps/web/`：Vite + React + TypeScript 占位应用（能 `npm run dev` 起一个空白首页即可）。
   - `apps/api/`：FastAPI 占位服务（一个 `/health` 路由返回 `{"status":"ok"}`）。
   - `textcore/`：Python 包占位（`contracts/ pipeline/{stages,runner.py,state.py} llm/ classics/ exporters/ storage/`，
     先放空模块 + docstring，不实现）。
   - `prompts/{rules,stages,qa}/`、`schemas/{stages,api}/`、`data/{db,uploads,processed,exports,classics}/`（带 `.gitkeep`）。
   - `tests/{fixtures,unit,integration,regression}/`。
2. 工程文件：
   - 根 `Makefile`：`make dev`（并行起前后端）、`make check`（前端 tsc/lint + 后端 ruff/pytest 占位，先保证能跑通不报错）、`make install`。
   - `AGENTS.md`：Codex/Claude 共同工作规则（参考 §5，含信箱协议、分工、纪律、不动 docs/ 与素材/）。
   - `CLAUDE.md`：Claude Code 专用上下文（项目一句话、当前阶段指针、关键文档路径）。
   - `README.md`：在现有内容基础上**追加**一个"开发"小节（不要删除现有设计板说明）。
   - `.env.example`：列出 `DEEPSEEK_API_KEY=` 等占位变量；`.gitignore` 追加 `.env.local`、`data/`、`node_modules/`、`__pycache__/`、`*.pyc`、`dist/`、`.venv/`。
   - `ai/TASK_QUEUE.md`、`ai/HANDOFF_TEMPLATE.md`（任务/交接模板）。
3. Python 后端用 `uv` 或 `venv + requirements.txt`（二选一，注明）；前端用 `npm`。

### 不做
- 不实现任何业务逻辑、Schema 内容、流水线、API 业务路由（除 /health）。
- 不碰 `docs/`、`00_产品设计/`、`素材/`、`tools/`、`ai/decisions/`。
- 不提交 git（由 Claude 审查后统一提交）。
- 不写真实密钥。

### 验收标准
- `make install` 能装好前后端依赖。
- `make dev` 能同时起 Vite（前端空白页）和 FastAPI（`/health` 返回 ok）。
- `make check` 跑通且无报错（占位级即可）。
- 目录结构与开发计划 §3.2 一致。
- `.env.local` / `data/` 已被 gitignore。

### 完成后
- 在 `handoff/OUTBOX_CODEX.md` 写：做了什么、目录树、如何启动、`make check` 结果、遗留问题/需确认项。
- 在 `handoff/LOG.md` 追加：`[时间] CODEX: T001 Phase0 脚手架完成`。
