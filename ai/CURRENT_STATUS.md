# 文心 TextCore · 协作状态板

> 唯一真相：本文件 + handoff/ + git + 测试结果。

## 分支
- `pipeline-fusion`（当前工作分支，含全部前端+后端融合改造）
- `frontend-polish`（前端收尾 A1-A3，已并入 pipeline-fusion 基础）
- 基线 tag `v0.8-baseline`（可回退）
- **未合并 main**（待用户验收后合）

## 已完成（本轮无人值守自主推进）
- ✅ **分支 A 速度**：单篇 30min → **6.4min**。A1 保真版确定性化(LLM只提元数据) + A2 chunk级并发(线程池6) + A3 模型路由(S4/S6→flash,S7/S8保pro)。
- ✅ **分支 B 质量**：B1 五维质量记分卡(`scripts/score_quality.py`) + B2 concise风格契约(流畅86→97) + 记分卡classics_safety修正。融合版质量分 86-89。
- ✅ **② A4 前端状态闭环**：刷新恢复/处理中/失败/SSE中断/导出三态。
- ✅ **③ 知识资产聚合**：`textcore/assets` + `GET /api/assets` + 前端资产页跨课汇总。
- ✅ **修 `make dev`**：uvicorn 从根目录起 + --app-dir。
- 全程 make check 绿（48 passed）。caffeinate 防睡运行中。

## 进行中
- 🔄 **① 批量处理 18 篇**（keystone）：`scripts/batch_process.py` 后台跑，报告 `data/batch_report.csv`。每篇质量分 ~90，四档 ~100/32/12/5。约 7-9min/篇，~2小时。
  - 注：#1(第一讲)因测试残留course_id重复在批量里失败，但已在测试时单独处理过。
- 🔄 **⑦ Word 导出精修**（Codex 并行）。

## 待办（批处理跑完后）
- ⏳ ④ 处理进度可视化(runner chunk级事件+partial state)——涉及runner,等批处理跑完再动
- ⏳ ⑨ 代码整合 + 文档收口
- ⏳ (有余力) ⑥回归加固 / ⑤古文库扩充殆知阁

## 需要用户（回来后）
- Phase 7.5 端到端验收(妈妈读)、前端视觉终审、命名决策、Mac mini部署、合并main
- 更深文采调优(few-shot/换强模型)需用户读感判断

## 关键命令
- 跑应用：`make dev`（前端 http://localhost:5173 / 后端 :8000）
- 批量：`PYTHONPATH=. .venv/bin/python scripts/batch_process.py`
- 质量打分：`PYTHONPATH=. .venv/bin/python scripts/score_quality.py --all`
- DeepSeek key 在 `.env.local`（不入库）
