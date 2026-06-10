# 文心 TextCore · 协作状态板

> 唯一真相：本文件 + handoff/ + git + 测试结果。AI 不靠记忆交接。

## 当前阶段
- **第一步 决策固化**：✅ 完成（ADR-001 技术栈、ADR-004 四档版本）
- **第二步 Phase 0 工程脚手架**：✅ 完成。提交 `01fe82f`
- **第三步 数据契约 + Schema 冻结**：✅ 完成（Claude 亲写，make check ✓ 8 passed）。提交 `1159d37`。**契约已冻结**：schemas/course_state.schema.json
- **第四步 后端存储+API（Codex T002）**：✅ 完成。SQLite + FastAPI(upload/list/detail/SSE/export) + 假流水线。Claude 验收：真实 docx 端到端 ✓（上传→列表→详情四档→导出合法Word）
- **第五步 前端 React 迁移（Codex T003）**：✅ 完成。demo→React，四档tab/古文引用/复核标记/抽屉，接 API。npm check+build ✓
- 🏁 **M1 里程碑达成**：真实前后端跑通假数据闭环。make check ✓ 9 passed
- **第六步 确定性流水线 S0–S3（Codex）/ 第七步 古文参考服务（Claude）**：⏭️ 下一步
- 遗留：前端用 History API 路由（react-router-dom 待网络可用补）；知识资产页待后端资产 API

## 分工
- Claude Code：架构 + 要害模块（数据契约/Schema、流水线 runner、LLM 适配器、古文匹配、回归框架）+ 调度 Codex + 审查每个 diff。
- Codex CLI（gpt-5.5 / 高推理）：主力码量（脚手架、存储/API、前端迁移、S0–S3、导出、部署）。

## 关键约束
- 不动 `docs/`（现有设计板 + GitHub Pages 源），不删 `00_产品设计/`、`素材/`。
- 密钥只进 `.env.local`，禁止提交。
- 契约冻结后才并行；每个 Codex 产出必经 Claude 审查 + `make check` 全绿才提交。
- 工作分支：`dev/phase-0`。

## 飞书通知
- 每步开始/结束推送：`cd ~/Products/ai-control-tower && ./node_modules/.bin/tsx scripts/notify.ts "消息"`

## 下一步
- Codex 完成 Phase 0 脚手架 → Claude 审查 → Claude 开写第三步数据契约 + Schema（冻结）。

## 阻塞
- 无。
