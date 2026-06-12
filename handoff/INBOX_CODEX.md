# INBOX · Codex · P1 确定性 scaffold 模块（泛化版，纯函数+单测，零 LLM）

> 流水线融合 Phase 1。当前分支 `pipeline-fusion`。**只新增 `textcore/pipeline/deterministic/` 和 `tests/`**。
> **不动 schema、前端、API、现有 S0-S10 stage 文件**（本步只产出可被未来调用的模块，不接进流水线）。
> 结果写 `handoff/OUTBOX_CODEX.md`，`LOG.md` 追加一行。**不提交 git**（Claude 审查后提交）。
> 背景见 `handoff/TextCore_确定性工具与LLM流水线融合改造方案.md` 和 `..._独立高保真样例生成工具说明.md`；参考源码 `tools/generate_full_samples.py`（只读，抽思想不照搬）。

## 目标
把 `tools/generate_full_samples.py` 的确定性清洗/切句/打分/按比例抽取，抽成**泛化的、可复用的纯函数模块**，作为后续 S4/S7 的 scaffold(基线) 与 quality gate(比例门)。本步只做模块+单测，**不接进流水线**。

## ★最重要的要求：泛化，不要照搬 demo 的硬编码
源工具的 `chunk_title()` 和部分关键词（醉叟/袁宏道/明线暗线/W教授…）是**为那 2 篇 demo 手写死的**，对其它文章会失效。本步必须泛化：

- **关键词按"类别"组织，广谱适用**，而不是抄具体篇目的人名/篇名：
  - 话语标记类（最通用）：第一/第二/第三/首先/其次/最后/所以/因此/总之/注意/重点/核心/关键/说明/意味着/总结
  - 方法类：方法/步骤/技巧/规律/原则/思路
  - 阅读题类：题型/答题/概括/赏析/分析/作用/表达效果/中心/主旨/引用/比喻/修辞
  - 作文类：作文/立意/选材/结构/开头/结尾/语言/详略/描写/议论
  - 文言/古诗类：文言文/古诗/词/句读/翻译/字词/通假/活用/意象/典故
  - 这些是**通用语文课词表**，不含具体人名/篇名。
- **章节标题不要硬编码**：`scaffold` 的 chunk 标题用通用启发式（取本块得分最高句的前 N 字 / 或首个重要句的主干），并注明"标题后续可由 S6/LLM 改写"。不要写 `if "袁宏道" in text: return ...` 这类样本规则。
- 错字：**不要在清洗里硬替换**（源工具那句 `罪首→醉叟`、`古兽行销→骨瘦形销` 不要照搬）。只保留极少数高置信通用口误，其余疑似错字一律产出 `review_flags` 候选，交给后续 S5 古文参考服务核对。

## 新增模块（`textcore/pipeline/deterministic/`）
1. `__init__.py`
2. `transcript_cleaner.py`
   - `clean_transcript_text(text, *, preserve_spans=()) -> {"text", "review_flags", "applied_repairs"}`
   - 去时间戳/说话人前缀、去口头禅(嗯/呃/这个/那个/是不是/对吧/能理解吧)、去明显课堂管理语、压缩重复标点。
   - **`preserve_spans` 内的文言文/古诗词/作文原句一字不改**（regex 不得触碰这些片段）。
   - 疑似错字 → `review_flags` 候选，不硬改。
3. `sentence_ranker.py`
   - `sentence_split(text) -> list[str]`
   - `score_sentence(sentence, position, *, keyword_sets) -> int`（类别词表加权 + 位置加权 + 长度过滤 + 噪声降权）
   - `important_sentences(text|paragraphs, limit) -> list[str]`
   - 关键词用上面的**类别词表**（放模块常量，便于扩展）。
4. `version_scaffold.py`
   - `build_chunk_scaffolds(*, chunk_id, title, original_text, cleaned_text=None, course_types=None, preserve_spans=()) -> dict`
   - 产出四档基线（用 `char_count` 真实计算、`compression`）：
     - `faithful`：≈85%–92%（在 cleaned_text 基础上轻拼装，保留逐句）
     - `concise`：≈30%–35%（抽取式，`target_chars=max(760,int(src*0.32))`，逐句选到达标，再按原序排列——参考源 `medium_digest_sentences`）
     - `study`：≈8%–12%（重点句/方法句列表）
     - `outline`：≈4%–6%（块标题 + 1–2 条核心句）
   - 返回结构与 `$defs/version` 一致（body_md/char_count/compression），便于后续直接用。
5. `quality_gates.py`
   - `check_version_ratio(*, version_key, actual_chars, source_chars, preferred, hard) -> {"ok", "level"("ok"|"warning"|"risk"), "ratio", "action"("accept"|"retry"|"fallback")}`
   - 区间：faithful preferred 0.85-0.93 / hard 0.70-0.95；concise 0.28-0.38 / 0.22-0.45；study 0.08-0.12 / 0.05-0.15；outline 0.04-0.07 / 0.03-0.10。

## 单测（`tests/unit/test_deterministic_scaffold.py`，不依赖真实 LLM）
- 对 **4 篇真实 Word**（都在 `素材/`）跑 S0→S3（用现有 `parse_docx/preclean/segment/chunk`），再对每个 chunk 调 `build_chunk_scaffolds`：
  1. 五上-人文综合涵养-寒假-第二讲-虚实-晚秋初冬.docx
  2. 五上-人文综合涵养-寒假-第六讲-文言文阅读训练1.docx
  3. 五上-人文综合涵养-寒假-第三讲-隐显-偷钱+第四讲-文言文-醉叟传1.docx
  4. 五上-人文综合涵养-寒假-第七讲-阅读理解+作文点评2.docx
- 断言（整篇汇总比例，对原文总字数）：faithful 0.83–0.95 / concise 0.26–0.40 / study 0.06–0.14 / outline 0.03–0.08。**4 篇都要过**（验证泛化）。
- 断言：每个 chunk 四档都非空；preserve_spans 文本在 faithful 里原样存在；transcript_cleaner 不改 preserve_spans。
- `quality_gates` 单测：给定过短/超长 actual_chars，返回正确 level/action。

## 不做 / 边界
- 不接进 S4/S7/runner（P2/P3 再做）。不动 schema、前端、API、现有 stage 文件。
- 不照搬源工具的硬编码篇目规则/错字替换/HTML 渲染。
- 不提交 git。

## 验收标准
- `cd apps/web` 无关；后端 `make check` 全绿，新增确定性单测 4 篇真实 Word 比例全过。
- 模块为纯函数、无网络、无 LLM。规则泛化（无具体人名/篇名硬编码）。

## 完成后
- `OUTBOX_CODEX.md`：4 个模块接口、关键词类别表、4 篇真实 Word 的实际四档比例数字、泛化做法、与源工具差异、make check 结果、遗留。
- `LOG.md` 追加：`[时间] CODEX: P1 确定性scaffold模块 完成`。
