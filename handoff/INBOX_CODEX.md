# INBOX · Codex · B1 质量记分卡（纯规则 rubric，先度量）

> 分支 `pipeline-fusion`。**新增 `textcore/pipeline/deterministic/quality_rubric.py` + `scripts/score_quality.py` + 接入 S9 + 测试**。不动 schema、前端。**不提交 git**。结果写 OUTBOX，LOG 追加。

## 背景与目标
质量进化要"先能度量、再调"。本步建一个**纯规则**的五维质量记分卡（不调 LLM），用于：① 每篇产出量化分数；② 改提示词前后做 A/B 对比。借鉴 ACEA 四维 + CNewSum 的 Adequacy/Deducibility 概念。

## 新增 `textcore/pipeline/deterministic/quality_rubric.py`
纯函数，输入 course_state(或其字段)，输出五维分(各 0-100)+总分：
- `coverage`（覆盖/充分性）：concise/study 是否保留了 faithful 的关键词与实体。用 P1 的 `sentence_ranker` 关键词集 + chunk_results 的 entities，算"关键词/实体保留率"。代表 Adequacy。
- `structure`（结构清晰）：各版本是否有标题层级（## 数量 vs chunk 数）、每 chunk 是否有覆盖。
- `fluency`（语言流畅）：口语残留词频(嗯/呃/这个/那个/是不是/对吧/能理解吧)、重复标点、超长句比例（越少越高）。
- `coherence`（连贯）：连接词(因此/所以/换句话说/首先/其次)出现、段落数与 chunk 数匹配。
- `classics_safety`（古文安全）：classics_refs 中 matched 项 canonical_text 是否原样出现在正文、diffs 是否进了 review_flags（被擅改则扣分）。
接口建议：
```python
def score_course(course_state: dict) -> dict:
    # 返回 {"coverage":.., "structure":.., "fluency":.., "coherence":.., "classics_safety":.., "overall":..}
```

## 接入 S9 `s9_quality.py`
- S9 调 `score_course`，把 `overall` 写进 `quality.quality_score`（0-100，覆盖现有简单算法）。
- 五维明细写进 `quality.main_risks`（用 `[score] coverage=82 structure=90...` 这类字符串，schema 不变）。
- 保留 S9 现有的 preferred/hard 比例检查与古文保护逻辑。

## 新增 `scripts/score_quality.py`
- CLI：`python scripts/score_quality.py <course_state.json 或 course_id>`，打印五维分。
- 支持批量：`python scripts/score_quality.py --all`，扫 `data/processed/*/course_state.json`，输出一张表（课程名 + 五维 + 总分），供改前/改后对比。
- 纯读取 + 评分，不联网不改数据。

## 边界
- 纯规则、零 LLM、零网络。不改 schema/前端/其它 stage 逻辑(除 S9 接入)。不提交 git。

## 测试(`tests/unit/test_quality_rubric.py`)
- 构造一个高质量 course_state(有标题/低口语/古文未改) → 五维分高。
- 构造一个低质量(口语多/无标题/古文被改) → 对应维度低分。
- S9 接入后 quality_score 来自 rubric。

## 验收
- `make check` 全绿。`python scripts/score_quality.py --all` 能对现有课程打分输出表。

## 完成后
- `OUTBOX_CODEX.md`：五维算法、S9 接入、score_quality 用法、对现有6篇课程的实际打分表、测试、make check 结果。
- `LOG.md` 追加：`[时间] CODEX: B1 质量记分卡 完成`。
