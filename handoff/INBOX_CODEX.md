# INBOX · Codex · ③ 知识资产库聚合（后端聚合 API + 前端展示）

> 分支 `pipeline-fusion`。碰 `textcore/`(新增聚合模块)、`apps/api/main.py`(新端点)、`apps/web/`(资产页)。**不动 schema(course_state)、不动 runner/流水线 stage**（后台批处理正在用流水线，勿碰）。**不提交 git**。结果写 OUTBOX，LOG 追加。

## 背景
知识资产页目前只有入口+空态。现在批处理正在把 ~18 篇课的 knowledge_cards/writing_materials 写进各 course_state。本步做"跨课聚合"，把它们汇总成可浏览的资产库。

## 范围
1. **后端聚合** `textcore/assets/aggregate.py`(新模块,纯函数):
   - 读所有 course_state(经 repository 或扫 data/processed/*/course_state.json)。
   - 汇总：
     - 方法卡片库 = 所有 knowledge_cards，按 type 分组(method/person/event/concept/work/theme/mistake)，每条带来源 course_id+课程名。
     - 佳句素材册 = 所有 writing_materials，带来源。
     - 词汇生词本 = 暂用 knowledge_cards 里 type in (concept, work) 或文言字词类(没有专门字段就先用 concept)，带来源；无则空。
   - 去重(同标题同来源合并)。
2. **API** `apps/api/main.py` 新增 `GET /api/assets`：返回 `{cards:[...], materials:[...], vocab:[...]}`，每项含 source(course_id, course_title)。**不改 course_state schema**；这是只读聚合投影。
3. **前端** `apps/web` 资产页：三个 Tab(方法卡片库/词汇生词本/佳句素材册)从 `GET /api/assets` 渲染真实聚合数据；空时友好空态；卡片点"来源课程"可跳详情。

## 不做 / 边界
- 不改 course_state schema、不动 textcore/pipeline/(runner/stages)、不动 deterministic 模块(批处理在用)。
- 不引入硬编码假资产(数据全来自真实 course_state)。不提交 git。
- 测试用 fixture/tmp 数据，**不要依赖 data/processed 实时内容**(批处理在写)。

## 验收
- `make check` 全绿(新增聚合单测 + API 测试用 fixture)。
- `GET /api/assets` 返回聚合结构；前端资产页能渲染(有数据时列出，空时空态)。

## 完成后
- `OUTBOX_CODEX.md`：聚合逻辑、API 形状、前端渲染、测试、make check 结果、遗留(如词汇本数据来源)。
- `LOG.md` 追加：`[时间] CODEX: ③ 知识资产聚合 完成`。
