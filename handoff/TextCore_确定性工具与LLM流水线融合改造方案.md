# TextCore 确定性工具与 LLM 流水线融合改造方案

面向：Claude Code / Codex CLI / Cursor CLI

作者：Codex

日期：2026-06-12

## 0. 一句话结论

当前正式流水线的方向是对的：S0-S10 分阶段、可结构化、可接网站和数据库。但它过度依赖 LLM 自觉控制篇幅，导致保真版和精简版容易被压短。

早期高保真 demo 工具 `tools/generate_full_samples.py` 的优势正好相反：它不聪明，但非常可控，能稳定做到约 `91% / 31% / 9% / 5%` 的四档比例。

建议不要用旧工具替代流水线，而是把旧工具抽象成“确定性 scaffold 层”，嵌入正式 S4/S7/S9：

> 确定性工具负责覆盖率、比例、分块、抽取基线和兜底；LLM 负责书面化、语义合并、知识卡片、作文素材和古文旁征博引。

## 1. 当前正式流水线的现状

当前入口：

- `textcore/pipeline/runner.py`
- API 上传后调用 `run_fake_pipeline(...)`

当前流程：

```text
S0 parse_docx
  -> S1 preclean
  -> S2 segment
  -> S3 chunk
  -> S4 clean
  -> S5 classics
  -> S6 merge
  -> S7 versions
  -> S8 extract cards/materials
  -> S9 quality
  -> S10 save state
```

当前输出：

- `data/uploads/<course_id>/source.docx`
- `data/processed/<course_id>/course_state.json`
- SQLite `courses` 列表记录

当前 schema 已经足够承载四版结果：

```json
"versions": {
  "faithful": {"body_md": "...", "char_count": 0, "compression": 0.0},
  "concise": {"body_md": "...", "char_count": 0, "compression": 0.0},
  "study": {"body_md": "...", "char_count": 0, "compression": 0.0},
  "outline": {"body_md": "...", "char_count": 0, "compression": 0.0}
}
```

第一轮改造不建议改 schema。

## 2. 两套方案的优缺点

### 2.1 旧独立工具：`tools/generate_full_samples.py`

优点：

- 极快，不调 LLM。
- 每块约 3600 字，天然适合 C01/C02 页面导航。
- 通过 `target_chars = int(chunk.raw_chars * ratio)` 强控比例。
- 抽取式生成，不容易幻觉。
- 每个 chunk 都有输出，不容易漏掉后半篇。
- 可以稳定得到：
  - 保真清洗约 90%
  - 精简整理约 30%-35%
  - 学习整理约 9%-12%
  - 结构提纲约 4%-6%

缺点：

- 本质是规则和抽句，不是真正理解式重写。
- 有时句子之间衔接生硬。
- 口语痕迹仍会残留。
- 文言文、古诗词、人物作品的纠错能力有限。
- 不能直接产出正式 `course_state.json` 所需的知识卡、作文素材、古文参考关系。

### 2.2 当前 LLM 流水线

优点：

- 架构完整，能接前后端。
- 能产出 `course_state.json`、知识卡片、作文素材、复核标记。
- 能做古文参考服务、旁征博引、全局摘要。
- 未来可替换模型，适合产品化。

缺点：

- S4/S7 对压缩率只是“提示词约束”，不是“代码硬约束”。
- S4 保真清洗如果被模型误解成摘要，后面无法补回。
- S7 精简版即使提示 30%-40%，模型仍可能只给 18%-20%。
- 当前 runner 最后一次性落盘，长时间运行时缺少中间 checkpoint。
- 流水线失败时没有确定性兜底版本。

## 3. 核心改造原则

### 原则 1：LLM 不负责控制比例，代码负责控制比例

模型可以润色、合并、改写，但“到底要剩多少字”必须由代码检查。

### 原则 2：每个 chunk 先有 scaffold，再让 LLM 处理

每个 chunk 至少生成四个确定性基线：

```text
faithful_scaffold  约 85%-92%
concise_scaffold   约 30%-35%
study_scaffold     约 8%-12%
outline_scaffold   约 4%-6%
```

LLM 输出失败、过短、超时、不合格时，可以回退 scaffold。

### 原则 3：保真版优先“保住内容”，不是追求漂亮

保真清洗版是后续所有版本的底座。宁可稍微口语一点，也不能损失讲解链条。

### 原则 4：正式流水线仍然是唯一产品入口

独立工具不要直接变成产品入口。它应被拆成确定性模块，被 S4/S7/S9 调用。

## 4. 建议新增模块

新增目录：

```text
textcore/pipeline/deterministic/
  __init__.py
  transcript_cleaner.py
  sentence_ranker.py
  version_scaffold.py
  quality_gates.py
```

### 4.1 `transcript_cleaner.py`

职责：

- 去时间戳和说话人噪声。
- 去口头禅：嗯、呃、这个、那个、是不是、对吧、能理解吧。
- 去低价值课堂管理语：谁来读、请坐、上麦、提交、拿稿纸。
- 保留老师的讲解顺序。
- 维护高置信 ASR 错字词典。

建议从 `tools/generate_full_samples.py::clean_text()` 抽取，但要做成正式纯函数。

示例接口：

```python
def clean_transcript_text(text: str, *, mode: str = "faithful") -> CleanResult:
    ...
```

返回：

```python
{
  "text": "...",
  "review_flags": [...],
  "applied_repairs": [...]
}
```

注意：

- 文言文原文、古诗词原文、学生作文原句必须尊重 `must_preserve_spans`。
- 低置信纠错不能直接改，应进入 `review_flags`。

### 4.2 `sentence_ranker.py`

职责：

- 中文句子切分。
- 关键词打分。
- 位置加权。
- 长度过滤。
- 噪声降权。

从旧工具抽取：

- `sentence_split()`
- `sentence_score()`
- `important_sentences()`
- `medium_digest_sentences()`

示例接口：

```python
def rank_sentences(
    text: str,
    *,
    course_types: dict,
    target_ratio: float,
    min_chars: int,
) -> list[RankedSentence]:
    ...
```

### 4.3 `version_scaffold.py`

职责：

根据一个 chunk 的原文或 S4 cleaned_text，生成四档确定性基线。

示例接口：

```python
def build_chunk_scaffolds(
    *,
    chunk_id: str,
    title: str,
    original_text: str,
    cleaned_text: str | None,
    course_types: dict,
    preserve_spans: list[dict],
) -> ChunkScaffolds:
    ...
```

建议输出：

```python
{
  "faithful": {"body_md": "...", "char_count": 3200, "compression": 0.91},
  "concise": {"body_md": "...", "char_count": 1100, "compression": 0.32},
  "study": {"body_md": "...", "char_count": 320, "compression": 0.10},
  "outline": {"body_md": "...", "char_count": 170, "compression": 0.05}
}
```

### 4.4 `quality_gates.py`

职责：

- 版本长度检查。
- chunk 覆盖检查。
- 输出为空检查。
- 过度压缩检查。
- 是否需要重试或 fallback。

示例接口：

```python
def check_version_ratio(
    *,
    version_key: str,
    actual_chars: int,
    source_chars: int,
    hard_range: tuple[float, float],
    soft_range: tuple[float, float],
) -> QualityDecision:
    ...
```

## 5. 对 S4 的具体改造

当前 S4：

```text
chunk original -> LLM -> chunkResult.cleaned_text
```

问题：

- prompt 要求保留 70%-90%，但代码不检查。
- 一旦 S4 被压缩，后面 S7 无法恢复被删掉的讲解。

建议改为：

```text
chunk original
  -> deterministic faithful_scaffold
  -> LLM clean
  -> ratio check
  -> retry if too short
  -> fallback faithful_scaffold if still too short
```

伪代码：

```python
original_text = paragraph_text_for_chunk(chunk, paragraphs)
scaffold = build_faithful_scaffold(original_text, preserve_spans=...)

obj, result = llm_client.complete_json(...)
ratio = text_len(obj["cleaned_text"]) / text_len(original_text)

if ratio < 0.70:
    obj, result = llm_client.complete_json(
        system,
        user + "\n\n你的上次输出过度摘要。请补回逐句讲解，保留 70%-90%。",
        schema,
        stage="S4",
    )

if still ratio < 0.70:
    obj["cleaned_text"] = scaffold.body_md
    obj["review_flags"].append({
      "category": "pipeline_fallback",
      "severity": "medium",
      "reason": "S4 LLM 输出低于保真比例，已回退确定性保真清洗"
    })
```

建议 S4 通过标准：

- `cleaned_text / original_chunk_text >= 0.70`
- 推荐区间 0.80-0.92
- 绝不能低于 0.60 后继续进入 S7

## 6. 对 S7 的具体改造

当前 S7：

- `faithful`：拼装 S4 `cleaned_text`
- `concise`：逐 chunk 调 LLM
- `study`：拼装 S4 `key_points`
- `outline`：用 S6 `outline_tree` 或 fallback

问题：

- `concise` 没有逐 chunk 比例硬检查。
- `study` 太依赖 S4 key_points。
- `outline` 如果 S6 稀疏，内容不够可读。

建议 S7 改为：

```text
S4 cleaned_text + chunk metadata
  -> build deterministic scaffolds for concise/study/outline
  -> concise: LLM polish with scaffold, ratio gate, fallback
  -> study: deterministic scaffold first, optional LLM rewrite later
  -> outline: S6 tree + scaffold merge
```

### 6.1 精简整理版

目标：

- 每个 chunk 输出保留 S4 cleaned_text 的 30%-40%。
- 全文最终约 28%-38% 原文。
- 必须是成段笔记，不是要点。

建议 prompt 输入增加：

```json
{
  "chunk_clean": "...",
  "coverage_scaffold": "...",
  "target_ratio": "30%-40%",
  "hard_min_chars": 900,
  "source_chars": 3000
}
```

LLM 任务从“自己摘要”改为：

> 请在 coverage_scaffold 的覆盖范围基础上整理润色，不能少于 hard_min_chars，不能漏掉 scaffold 中的主要讲解链条。

### 6.2 学习整理版

目标：

- 8%-12%。
- 可用列表。
- 重点是复习抓手，而不是完整笔记。

建议：

- 先由 `version_scaffold.py` 从 cleaned_text 抽取 study scaffold。
- 可先不调 LLM，保持稳定。
- 后续可增加 LLM 把抽取句改成更像复习卡。

### 6.3 结构提纲版

目标：

- 4%-7%。
- 每个 C 段至少有一个可读条目。

建议每段格式：

```md
## C01 虚实相生与文章背景
- 原段落：p0003-p0043
- 本段核心：...
- 复习抓手：...
- 易错/迁移：...
```

## 7. 对 S9 的具体改造

当前 S9 已经有 compression range：

```python
faithful: 0.65-0.90
concise: 0.25-0.45
study: 0.05-0.15
outline: 0.03-0.10
```

建议调整：

1. S9 继续作为最终质检。
2. S4/S7 必须新增“前置质量门”，不要等到 S9 才发现失败。
3. S9 的 range 可以略贴近用户认可值：

```python
faithful: preferred 0.85-0.93, hard 0.70-0.95
concise: preferred 0.28-0.38, hard 0.22-0.45
study: preferred 0.08-0.12, hard 0.05-0.15
outline: preferred 0.04-0.07, hard 0.03-0.10
```

S9 输出 `main_risks` 时区分：

- `warning`：偏离 preferred 但仍在 hard range。
- `risk`：超出 hard range。

## 8. 对 runner 的改造建议

当前 `runner.py` 只在最终 S10 保存 state。真实 LLM 长文处理时，用户会长时间不知道进度。

建议增加：

- 每个 stage 的开始/结束日志继续保留。
- S4/S7/S8 增加 chunk 级事件。
- 每个 stage 完成后保存一次 partial state。

最小改造：

```text
data/processed/<course_id>/partial/
  S0.json
  S1.json
  S2.json
  S3.json
  S4.json
  ...
```

或者在 `course_state.json` 中允许 `status=processing` 的中间态。第一版为降低 schema 风险，可以先写 partial 文件，不进入正式 schema。

## 9. 建议实施步骤

### Phase 1：只抽确定性模块，不接 LLM

目标：

- 从 `tools/generate_full_samples.py` 抽出纯函数。
- 不改 schema。
- 不改 API。
- 新增单测。

交付：

- `textcore/pipeline/deterministic/transcript_cleaner.py`
- `textcore/pipeline/deterministic/sentence_ranker.py`
- `textcore/pipeline/deterministic/version_scaffold.py`
- `tests/unit/test_deterministic_scaffold.py`

验收：

- 对两篇真实 Word 的 S0-S3 输出生成 scaffold。
- 比例接近：
  - faithful 85%-93%
  - concise 28%-38%
  - study 8%-12%
  - outline 4%-7%

### Phase 2：S4 接入 faithful scaffold + 比例门

目标：

- S4 LLM 输出过短时自动重试。
- 重试失败回退 deterministic faithful。

验收：

- mock provider 故意返回过短 cleaned_text，S4 能重试或 fallback。
- 真实样本不能出现 faithful 低于 70% 还继续通过。

### Phase 3：S7 接入 concise/study/outline scaffold

目标：

- concise 每 chunk 有 scaffold。
- LLM 精简结果低于 hard min 时 fallback。
- study 和 outline 先用 scaffold 稳定输出。

验收：

- mock provider 返回过短 concise，最终版本仍能达到 25% 以上。
- 两篇真实样本的四档比例接近用户认可 demo。

### Phase 4：runner 增加 chunk 级进度与 partial state

目标：

- 真实跑一篇 3 万字 Word 时，前端能看到 C01/C02 级别进度。
- 中途失败可定位到 stage/chunk。

验收：

- SSE 事件包含 stage、chunk_id、chunk_index、chunk_total。
- 失败时保留 partial 输出。

### Phase 5：再考虑 LLM 润色升级

在 deterministic scaffold 稳定后，再让更强模型负责：

- 精简版段落润色。
- 学习版复习语言优化。
- 知识卡片和作文素材抽取。
- 古文旁征博引表达。

不要一开始就追求 fine-tune 或复杂分词器。

## 10. 回归样本建议

固定使用至少四类真实 Word：

1. `素材/五上-人文综合涵养-寒假-第二讲-虚实-晚秋初冬.docx`
2. `素材/五上-人文综合涵养-寒假-第六讲-文言文阅读训练1.docx`
3. `素材/五上-人文综合涵养-寒假-第三讲-隐显-偷钱+第四讲-文言文-醉叟传1.docx`
4. `素材/五上-人文综合涵养-寒假-第七讲-阅读理解+作文点评2.docx`

不要在 CI 里调用真实 LLM。CI 只测 deterministic scaffold、schema、fallback、mock LLM。

真实 LLM 回归用手动脚本跑。

## 11. 如果由 Codex 主导，我会这样改

我会按下面顺序推进：

1. **先抽模块**：把 `generate_full_samples.py` 的清洗、切句、打分、按比例抽取，抽到 `textcore/pipeline/deterministic/`。
2. **先写测试**：用真实 Word 跑 S0-S3，再对 chunk 生成四档 scaffold，测试比例和非空。
3. **改 S4**：新增保真比例检查、重试、fallback。
4. **改 S7**：concise 加 scaffold 和 fallback；study/outline 先 deterministic 化。
5. **改 S9**：区分 preferred/hard ranges，让质检更贴近用户认可标准。
6. **补进度**：runner 加 chunk 级事件和 partial state。
7. **再真实跑样本**：跑两篇已手工处理的 Word，对比比例和可读性。

这套路径风险较低，因为：

- 不动 schema。
- 不动前端。
- 不动 API 契约。
- 可以先纯单测验证。
- 失败时有 scaffold 兜底。

## 12. 给 Claude Code 的执行指令

可以直接把下面这段发给 Claude Code：

```text
请阅读以下两份 Codex 文档：

1. handoff/TextCore_独立高保真样例生成工具说明.md
2. handoff/TextCore_确定性工具与LLM流水线融合改造方案.md

目标：学习早期高保真 demo 工具 `tools/generate_full_samples.py` 的确定性清洗、分块、句子打分和按比例抽取方法，并把它作为 scaffold/quality gate 融入当前正式 S0-S10 流水线。

请先不要大改前端，也不要改 schema。建议按以下顺序审查并提出实施计划：

1. 抽取 `textcore/pipeline/deterministic/` 模块：
   - transcript_cleaner.py
   - sentence_ranker.py
   - version_scaffold.py
   - quality_gates.py

2. 给 S4 增加 faithful scaffold、长度比例检查、重试和 fallback。

3. 给 S7 增加 concise/study/outline scaffold：
   - concise 仍可由 LLM 润色，但必须有 30%-35% 的 scaffold 和不足 fallback。
   - study/outline 可以先 deterministic scaffold 输出，后续再接 LLM 润色。

4. 给 S9 区分 preferred/hard compression ranges。

5. 新增单测，不依赖真实 LLM：
   - 对真实 Word 跑 S0-S3 后生成 deterministic scaffold。
   - 验证四档比例大致为 faithful 85%-93%、concise 28%-38%、study 8%-12%、outline 4%-7%。
   - mock LLM 返回过短内容时，S4/S7 能重试或 fallback。

关键判断：这个工具不是替代 LLM，而是让 LLM 流水线有确定性骨架。代码负责覆盖率和比例，模型负责书面化和结构化。

请先输出你的实施计划和风险点，再决定是否开始改代码。
```

