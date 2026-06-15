# 文心 TextCore · 协作状态板

> 唯一真相：本文件 + handoff/ + git + 测试结果。

## 分支
- `pipeline-fusion`（当前工作分支，**PR #1**，含全部前端+后端融合改造）
- 基线 tag `v0.8-baseline`（可回退）
- **未合并 main**（待用户验收后合）

## 已完成（本轮无人值守自主推进 · 全在 PR #1）
- ✅ **分支 A 速度**：单篇 30min → **6.4min**。A1 保真版确定性化(LLM 只提元数据) + A2 chunk 级并发(线程池 6) + A3 模型路由(S4/S6→flash，S7/S8 保 pro)。
- ✅ **分支 B 质量**：B1 五维质量记分卡(`scripts/score_quality.py`) + B2 concise 风格契约(流畅 86→97) + 记分卡 classics_safety 修正。融合版质量分 86-91。
- ✅ **① 批量 18 篇**（keystone）：17/18 真实课入库，质量均 91，产出 347 卡片 / 153 素材 / 50 古文命中。报告 `data/batch_report.csv`。
  - 注：#1(第一讲) 因测试残留 course_id 重复在批量里跳过，已在测试时单独处理(q=91)。
- ✅ **② A4 前端状态闭环**：刷新恢复/处理中/失败/SSE 中断/导出三态。
- ✅ **③ 知识资产聚合**：`textcore/assets` + `GET /api/assets` + 前端资产页跨课汇总(468 卡片/207 素材/213 词汇)。
- ✅ **④ 处理进度可视化**：runner chunk 级事件(chunk_index/chunk_total) + partial state 落盘 + 前端进度细化。
- ✅ **⑦ Word 导出精修**：标题层级/Markdown 转换/古文分层引用样式/复核灰色/printable vs archive 版式差异。
- ✅ **修 bug**：`make dev`(uvicorn 根目录起 + --app-dir)、Codex 派发 stdin 卡死(加 `< /dev/null`)。
- ✅ **⑨ 文档收口**：CLAUDE.md 反映真实架构、本状态板。
- 全程 `make check` 绿（**53 passed**）。caffeinate 防睡运行中。

## 可选未做（低价值，本轮主动跳过避免拖时间）
- ⑤ 古文库扩充(殆知阁)　·　⑥ 回归加固

## 需要用户（回来后）
- Phase 7.5 端到端验收(妈妈读)、前端视觉终审、命名决策(精简/学习)、Mac mini 部署、合并 main
- 更深文采调优(few-shot/换强模型)需用户读感判断

## 关键命令
- 跑应用：`make dev`（前端 http://localhost:5173 / 后端 :8000）
- 批量：`PYTHONPATH=. .venv/bin/python scripts/batch_process.py`
- 质量打分：`PYTHONPATH=. .venv/bin/python scripts/score_quality.py --all`
- DeepSeek key 在 `.env.local`（不入库）
- PR：https://github.com/xymu2026-boop/textcore-design-board/pull/1
