# OUTBOX · Codex · B1 质量记分卡

## 改动范围

- 新增 `textcore/pipeline/deterministic/quality_rubric.py`。
- 新增 `scripts/score_quality.py`。
- 修改 `textcore/pipeline/stages/s9_quality.py` 接入 rubric 分数。
- 新增 `tests/unit/test_quality_rubric.py`。
- 未改 schema、前端、其它 stage 逻辑；未提交 git。

## 五维算法

- `coverage`：取 `sentence_ranker.DEFAULT_KEYWORD_SETS` 中实际出现在 faithful/S4 文本里的关键词，加上 `chunk_results[*].entities`；统计这些词/实体在 concise+study 中的保留率。关键词/实体同时存在时按 55%/45% 合成。
- `structure`：各版本标题数量与 chunk 数对齐度 + 标题层级；再结合 chunk 覆盖率（chunk_id/title/key_points 是否出现在四档正文）。
- `fluency`：按口语残留词（嗯/呃/这个/那个/是不是/对吧/能理解吧）、重复标点、超长句比例扣分。
- `coherence`：统计连接词（因此/所以/换句话说/首先/其次）出现情况，并检查 concise 段落数与 chunk 数是否匹配。
- `classics_safety`：matched `classics_refs` 的 `canonical_text` 是否原样出现在正文；每个 diff 是否进入 `review_flags`。
- `overall`：五维等权平均，所有分数均为 0-100；全程纯规则、零 LLM、零网络。

## S9 接入

- S9 在 `evaluate_quality()` 中构造当前 `chunk_results/classics_refs/global/versions/review_flags` 的 course-state 片段并调用 `score_course()`。
- `quality.quality_score` 改为 rubric 的 `overall`。
- `quality.main_risks[0]` 写入五维明细，例如：
  - `[score] coverage=84 structure=96 fluency=86 coherence=78 classics_safety=50 overall=79`
- 原有 preferred/hard 版本比例检查、古文 diff 保护、review flag 聚合、`recommended_human_review` 逻辑保留。

## score_quality 用法

- 单篇 JSON：`python scripts/score_quality.py data/processed/<course_id>/course_state.json`
- 单篇 course_id：`python scripts/score_quality.py <course_id>`
- 批量：`python scripts/score_quality.py --all`
- 本机无 `python` shim，已用 `.venv/bin/python` 和 `python3` 验证同一脚本。

## 现有课程打分

`data/processed` 当前有 7 个 `course_state.json`（不是 6 个），批量输出如下：

| course_id | course | coverage | structure | fluency | coherence | classics_safety | overall |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| course_2026_01e2b6d8 | 五上秋季-人文综合涵养-第8讲-古诗词2 | 84 | 96 | 86 | 78 | 50 | 79 |
| course_2026_50543e78 | 五上-人文综合涵养-寒假-第三讲-隐显-偷钱+第四讲-文言文-醉叟传1 | 77 | 84 | 85 | 84 | 100 | 86 |
| course_2026_6236856c | 五上-人文综合涵养-寒假-第七讲-阅读理解+作文点评2 | 49 | 38 | 92 | 75 | 100 | 71 |
| course_2026_652f24cc | 五上-人文综合涵养-寒假-第三讲-隐显-偷钱+第四讲-文言文-醉叟传1 | 33 | 48 | 100 | 75 | 35 | 58 |
| course_2026_6725f111 | 五上-人文综合涵养-寒假-第七讲-阅读理解+作文点评2 | 83 | 83 | 81 | 90 | 100 | 87 |
| course_demo_essay | 五上-人文综合涵养-寒假-第七讲-阅读理解+作文点评2 | 88 | 85 | 70 | 64 | 100 | 81 |
| course_demo_zuisou | 五上-人文综合涵养-寒假-第三讲-隐显-偷钱+第四讲-文言文-醉叟传1 | 85 | 85 | 70 | 64 | 100 | 81 |

## 测试与验证

- `.venv/bin/python -m pytest tests/unit/test_quality_rubric.py tests/unit/test_s9_quality.py`：8 passed。
- `.venv/bin/python scripts/score_quality.py --all`：通过，输出上表。
- `.venv/bin/python scripts/score_quality.py course_2026_01e2b6d8`：通过。
- `make check`：通过。
  - 前端 typecheck/lint 通过。
  - `scripts/check_api.py` 通过。
  - 全量 pytest：45 passed，1 个既有 StarletteDeprecationWarning。
