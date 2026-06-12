# TextCore 独立高保真样例生成工具说明

面向：Claude Code / Codex CLI / 后续流水线实现者

更新时间：2026-06-12

## 1. 这个工具是什么

项目里已有一个早期高保真 demo 生成工具：

- 源码：`tools/generate_full_samples.py`
- 原始输出：`docs/prototype/full-samples.js`
- 运行方式：直接读取 `素材/` 中的 Word，生成前端 demo 可用的完整样例数据。

它不是正式后端流水线，也不调用 LLM。它的核心思路是：

> 直接读 Word -> 规则清洗 -> 按 3600 字左右分块 -> 句子打分 -> 按目标比例抽取 -> 渲染四档版本。

最近 Codex 手工处理两篇新 Word 时，复用了这套思想并做了临时增强，输出位置为：

- `data/manual_processed/2026-06-12_codex_two_lessons/`

两篇测试结果：

| 课程 | 原文字数 | 保真清洗 | 精简整理 | 学习整理 | 结构提纲 |
|---|---:|---:|---:|---:|---:|
| 寒假第二讲：虚实与《晚秋初冬》 | 30644 | 92.4% | 32.9% | 10.1% | 5.2% |
| 寒假第六讲：文言文阅读训练1 | 29971 | 91.2% | 32.5% | 9.7% | 5.3% |

这组比例接近用户认可的高保真 demo 目标：约 91% / 31% / 9% / 5%。

## 2. 为什么它看起来比当前 LLM 流水线更稳

它好用不是因为它更“聪明”，而是因为它更“可控”。

### 2.1 它从一开始就按比例生成

`medium_digest_sentences()` 内部有明确目标：

```python
target_chars = max(760, int(chunk.raw_chars * ratio))
```

默认 `ratio = 0.33`。它会逐块选句，直到接近目标字数。

当前正式流水线的 S7 精简版虽然提示词要求 30%-40%，但模型可能少给；代码只在最后统计比例，没有强制补足或重试。因此真实结果容易掉到 18%-20%。

### 2.2 它是逐块处理，不做整篇压缩

旧工具先把全文切成约 3600 字的 chunk，再对每个 chunk 独立生成版本。

好处：

- 每个 C 段都有覆盖，不容易只总结前半篇。
- 页面上的 C01/C02 导航天然有内容来源。
- 每块都能计算 `raw_chars`、`start_para`、`end_para`。
- 长文不会在一次生成里“塌缩”成几段大摘要。

### 2.3 它使用“抽取式”生成，天然不幻觉

精简版、学习版、提纲版主要从原文句子里挑选，不凭空改写。

这带来几个优势：

- 不会编造老师没讲过的内容。
- 文言文、人物、作品名不容易被模型自由发挥。
- 结果可追溯到原段落。
- 速度极快，适合做基线版本和质量兜底。

代价是：它不是真正的高级书面化重写，部分句子仍会保留口语痕迹，需要 LLM 或后处理进一步润色。

### 2.4 它有简单但有效的语文课关键词打分

旧工具使用 `sentence_score()` 和 `important_sentences()`：

- 方法词：第一、第二、第三、重点、核心、注意、所以、说明、意味着
- 阅读题词：题型、答题、概括、赏析、引用、比喻
- 作文/文本词：线索、明线、暗线、语言、作文
- 文言文词：文言文、袁宏道、醉叟

这些词并不复杂，但很贴近课堂讲解结构。老师讲重点时经常会说“所以”“注意”“第一”“第二”“方法”“题型”，因此抽取效果会比纯随机摘要稳定。

### 2.5 它保留了“课堂长文页面”需要的结构

旧工具输出里包含：

- chunk id
- chunk title
- 原段落范围
- chunk 字数
- 每个版本的 HTML section
- 上一段 / 回到目录 / 下一段按钮

这也是为什么早期高保真 demo 页面体验好：内容结构和前端交互是一体设计出来的。

## 3. 当前正式流水线的问题对比

当前后端流水线大致是：

`S0 parse -> S1 preclean -> S2 segment -> S3 chunk -> S4 LLM clean -> S5 classics -> S6 merge -> S7 versions -> S8 cards/materials -> S9 quality -> S10 save`

主要问题不在架构，而在“质量护栏不够硬”。

### 3.1 S4 保真清洗依赖 LLM 自觉

`prompts/stages/s4_clean.system.md` 已经写明：

- 保真清洗不是摘要
- cleaned_text 应保留 70%-90%

但当前 `textcore/pipeline/stages/s4_clean.py` 只校验 schema，不校验长度比例。

建议：

- S4 返回后立刻计算 `cleaned_text / original_chunk_text`。
- 若低于 70%，自动重试一次，并明确提示“你刚才过度摘要，请补回逐句讲解”。
- 若仍低于阈值，用确定性清洗版本兜底，并加 `review_flags`。

### 3.2 S7 精简版没有比例兜底

`prompts/stages/s7_concise.system.md` 要求 30%-40%，但 `s7_versions.py` 当前只统计，不强制。

建议：

- S7 每个 chunk 调 LLM 前，先用独立工具生成一个 `coverage_scaffold`，即 30%-35% 的抽取式基线。
- 把 `coverage_scaffold` 作为输入给 LLM，让模型“在不低于该覆盖量的前提下整理润色”。
- LLM 返回后若本 chunk 低于 25%，重试；若仍低于 25%，使用 `coverage_scaffold` 兜底。

### 3.3 学习整理版不应只依赖 S4 key_points

当前 `study` 是从 S4 `key_points` 代码拼装。它很稳，但容易过短，且取决于 S4 是否提得好。

建议：

- 学习版可使用 `important_sentences()` 的抽取结果作为材料。
- 再由 LLM 改写成“复习要点”，而不是完全依赖 S4 key_points。
- 目标比例保持 8%-12%。

### 3.4 Outline 需要可读骨架，不只是 S6 tree

当前 outline 优先用 S6 `outline_tree`。如果 S6 输出稀疏，会导致提纲过短或无味。

建议：

- outline 使用 `chunk_title + top important_sentences` 做兜底。
- 每个 C 段至少保留：
  - 原段落范围
  - 本段核心
  - 复习抓手
  - 易错/迁移点

## 4. 建议如何把独立工具能力并入正式工程

不要把 `tools/generate_full_samples.py` 直接搬进流水线。它原本是 demo 工具，输出 HTML/JS，耦合了前端原型。

建议抽出一个正式模块：

```text
textcore/pipeline/deterministic/
  transcript_cleaner.py
  chunk_extractor.py
  sentence_ranker.py
  version_scaffold.py
```

### 4.1 transcript_cleaner.py

职责：

- 去时间戳
- 去口头禅
- 去明显课堂管理语
- 修正高置信 ASR 错字
- 标记低置信疑点

来源：

- 从 `generate_full_samples.py::clean_text()` 抽取
- 补充课程领域错字词典，例如：
  - 德芙如花/得富如花/德夫芦花 -> 德富芦花
  - 公假字 -> 通假字
  - 此类活用词 -> 词类活用词
  - 罪首/最手/醉手 -> 醉叟

注意：

- 文言文原文、古诗词原文不能自动改，必须走 preserve span 或 review flag。

### 4.2 sentence_ranker.py

职责：

- 中文句子切分
- 关键词打分
- 位置加权
- 长度过滤
- 噪声降权

可从这些函数抽取：

- `sentence_split()`
- `sentence_score()`
- `important_sentences()`
- `medium_digest_sentences()`

### 4.3 version_scaffold.py

职责：

为每个 chunk 生成三个确定性基线：

- `faithful_scaffold`：约 85%-92%，规则清洗后拼装。
- `concise_scaffold`：约 30%-35%，抽取式课堂笔记。
- `study_scaffold`：约 8%-12%，重点句/方法句。
- `outline_scaffold`：约 4%-6%，chunk title + 核心句。

这些基线有两个用途：

1. 无 LLM 时可直接生成可读版本。
2. 有 LLM 时作为质量护栏，防止模型过度压缩。

## 5. 推荐的新流水线策略

建议把当前流水线改为“双轨制”：

```text
原文 chunk
  -> 确定性清洗/抽取轨：生成 scaffold + 比例目标
  -> LLM 润色/结构化轨：在 scaffold 基础上改写
  -> 质量检查：比例不足则重试或回退 scaffold
```

### S4 建议

当前：

```text
chunk original -> LLM -> cleaned_text
```

建议：

```text
chunk original
  -> deterministic faithful_scaffold
  -> LLM faithful clean
  -> length check
  -> if too short: retry
  -> if still too short: fallback faithful_scaffold
```

### S7 精简版建议

当前：

```text
S4 cleaned_text -> LLM concise -> concatenate
```

建议：

```text
S4 cleaned_text
  -> deterministic concise_scaffold(30%-35%)
  -> LLM polish using scaffold
  -> length check per chunk
  -> fallback concise_scaffold when under target
```

### S7 学习版建议

当前：

```text
S4 key_points -> code assemble
```

建议：

```text
S4 cleaned_text + deterministic study_scaffold
  -> optional LLM rewrite as review notes
  -> target 8%-12%
```

### S7 提纲版建议

当前：

```text
S6 outline_tree or fallback titles
```

建议：

```text
S6 outline_tree + deterministic outline_scaffold
  -> merge
  -> target 4%-6%
```

## 6. 验收标准

以 `素材/` 下真实 Word 为回归样本，至少覆盖：

- 现代文/作文讲评
- 文言文训练
- 古诗词讲解
- 混合课

每篇验收：

| 版本 | 目标比例 |
|---|---:|
| 保真清洗版 | 85%-92%，最低不低于 70% |
| 精简整理版 | 28%-38% |
| 学习整理版 | 8%-12% |
| 结构提纲版 | 4%-7% |

质量验收：

- 每个 chunk 都有输出，不能缺块。
- 版本字数按代码真实统计，不能信模型自报。
- 精简版不能只有要点，必须是可阅读段落。
- 学习版可以是列表，但每个要点要能用于复习。
- 文言文/古诗词原文不得擅改；疑似错字进入 review flags。
- 若 LLM 输出低于目标比例，应自动重试或回退 scaffold。

## 7. 对 Claude Code / Codex CLI 的建议任务拆分

### 任务 A：抽取确定性模块

从 `tools/generate_full_samples.py` 抽取纯函数，不要保留 HTML/JS 输出逻辑。

新增模块建议：

- `textcore/pipeline/deterministic/transcript_cleaner.py`
- `textcore/pipeline/deterministic/sentence_ranker.py`
- `textcore/pipeline/deterministic/version_scaffold.py`

### 任务 B：给 S4 增加保真比例检查

修改：

- `textcore/pipeline/stages/s4_clean.py`

要求：

- 计算原 chunk 字数和 `cleaned_text` 字数。
- 低于 70% 自动重试。
- 重试失败时 fallback 到 deterministic faithful scaffold。

### 任务 C：给 S7 增加 scaffold + fallback

修改：

- `textcore/pipeline/stages/s7_versions.py`

要求：

- 每个 chunk 先生成 `concise_scaffold`。
- LLM 输出不足时重试或回退。
- study / outline 也使用 deterministic scaffold 做兜底。

### 任务 D：新增真实样本回归

新增测试：

- 用 `素材/五上-人文综合涵养-寒假-第二讲-虚实-晚秋初冬.docx`
- 用 `素材/五上-人文综合涵养-寒假-第六讲-文言文阅读训练1.docx`

注意：测试不应直接依赖真实 LLM。可以先测 deterministic scaffold 的比例与结构。

## 8. 结论

这个独立工具的价值不是替代 LLM，而是给 LLM 流水线加上“可控骨架”：

- 它能稳定控制四档比例。
- 它能保证每个 chunk 都被覆盖。
- 它能给前端长文阅读提供自然的 C 段结构。
- 它能作为 LLM 失败、过短、超时后的兜底输出。

正式产品里，最优方案应该是：

> 确定性工具负责覆盖率、比例、结构和兜底；LLM 负责书面化、语义合并、知识卡片和更高级的表达整理。

