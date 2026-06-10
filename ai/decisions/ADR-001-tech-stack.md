# ADR-001：技术栈

- 状态：已采纳（2026-06-10）

## 决策

| 层 | 选型 |
| --- | --- |
| 前端 | React + Vite + TypeScript |
| 后端 | FastAPI (Python 3.11) |
| 数据库 | SQLite |
| 文件存储 | 本地文件系统（uploads / processed / exports / classics） |
| 流水线 | Python 实现 S0–S10 |
| 首选模型 | DeepSeek（先跑通）；Claude / 通义 / OpenAI 经统一 `LLMClient` 适配器后续接入 |
| 结构化输出 | JSON Schema 强约束 + 校验重试 |
| 古文参考 | 本地 chinese-gushiwen（释义层）+ 殆知阁（全文校验层），确定性服务 |

## 约束

- 第一版：本地运行、单用户、不上云、不做登录、不接知网。
- 仓库形态：monorepo，新代码与现有 `docs/`（设计板）同仓共存。
- 部署目标：Mac mini 本地 + 局域网访问。

## 相关

- [[ADR-004-version-tiers]]
- 详见《内容处理流水线实现方案 v0.2》《正式开发框架与 AI 协作计划 v0.1》。
