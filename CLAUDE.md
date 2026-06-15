# Claude Code Context

TextCore is a local-first app for turning course Word transcripts into readable study notes, knowledge cards, writing material, and exportable documents.

## Current State (2026-06)

可运行的本地应用。后端 FastAPI + SQLite，前端 React/Vite。流水线 S0–S10 真实跑通（DeepSeek）。
工作分支 `pipeline-fusion`（PR #1，未合 main，待人工验收）。状态板 `ai/CURRENT_STATUS.md`。

### 流水线（textcore/pipeline）
- S0 解析 → S1 预清洗 → S2 话题分割 → S3 分块（确定性）
- S4 **保真版确定性清洗**(`deterministic/transcript_cleaner`) + LLM 只提元数据
- S5 古文参考服务(`classics/`，本地 gushiwen 库匹配+错字 diff)
- S6 全局合并 → S7 四档版本(faithful 拼装 / concise LLM 润色+比例门兜底 / study·outline 确定性) → S8 卡片素材 → S9 质检 → S10 存
- **确定性 scaffold + 比例门 + 兜底**(`deterministic/`)保证四档比例稳定(~90/31/9/5)，不靠 LLM 自觉
- chunk 级并发(ThreadPoolExecutor 6)，单篇 ~6-7min。模型路由：S4/S6 flash，S7/S8 pro

### 四档版本(ADR-004)
英文 key：`faithful/concise/study/outline`，默认 `concise`。中文显示名前端映射。

### 常用命令
- `make dev`（前端 :5173 / 后端 :8000）  ·  `make check`
- 批量处理：`PYTHONPATH=. .venv/bin/python scripts/batch_process.py`
- 质量打分：`PYTHONPATH=. .venv/bin/python scripts/score_quality.py --all`
- DeepSeek key 在 `.env.local`（gitignore）；真实课稿在 `data/`（gitignore）

## Key Documents

- `00_产品设计/开发计划/TextCore_后续项目计划_v1.0_前端优先.md`
- `00_产品设计/技术方案/TextCore_内容处理流水线实现方案_v0.2.md`
- `ai/decisions/ADR-001-tech-stack.md` · `ADR-004-version-tiers.md`
- `AGENTS.md`

## Review Checklist

- Confirm Codex did not modify protected design/material paths.
- Run `make install` if dependencies are not present.
- Run `make check`.
- Verify `/health` returns `{"status":"ok"}` when `make dev` is running.
- Review `handoff/OUTBOX_CODEX.md` and `handoff/LOG.md`.
