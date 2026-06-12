# INBOX · Codex · A1 S4 重构：保真版确定性化 + LLM 只提元数据（速度核心）

> 分支 `pipeline-fusion`。**改 `textcore/pipeline/stages/s4_clean.py` + 新增提示词 + 改测试**。不动 schema、前端、其它 stage。**不提交 git**。结果写 `handoff/OUTBOX_CODEX.md`，`LOG.md` 追加一行。
> P1 模块可用：`deterministic.transcript_cleaner.clean_transcript_text(text, *, preserve_spans=())`。

## 背景与目标
实测：当前 S4 每块让 LLM 生成"完整 cleaned_text(2500字) + 全套元数据"，输出 5000-8000 token，**单块 68-174 秒**，× 13 块串行 = 30 分钟。
根因是**输出量太大**，不是模型慢。修法：**保真版 cleaned_text 改用确定性 transcript_cleaner 秒出（它能产 ~90-95% 清洗稿），LLM 只提小体量元数据**。目标单块 S4 从 ~100s 降到 ~10s。

## 改造 `s4_clean.py`
对每个 chunk：
1. **cleaned_text = 确定性清洗**：调 `clean_transcript_text(原文chunk, preserve_spans=chunk.must_preserve_spans)`，取其 `text` 作为 `chunkResult.cleaned_text`。原文用现有 `llm_stage.paragraph_text_for_chunk(chunk, paragraphs)`。该函数返回的 `review_flags` 候选并入下方 review_flags。
2. **LLM 只提元数据（小输出）**：新建一次 LLM 调用，**只产出** `key_points` / `student_answer_kept` / `entities`(persons/works/concepts) / `classics_candidates` / `review_flags`，**不再生成 cleaned_text**。输入给 LLM 的是"已清洗的 cleaned_text"（让它在干净文本上提取，更准更省）。
3. 组装 `chunkResult`（schema 不变）：cleaned_text(确定性) + 上面 LLM 元数据 + 合并 review_flags（确定性候选 + LLM）。
4. **删除**原 cleaned_text 的比例门重试/兜底逻辑（确定性版本天然 ~90-95%，不需要）。可保留一个 sanity assert：cleaned_text 非空。
5. 模型路由：元数据提取用 `deepseek-v4-flash` 即可（小任务，快）。stage 仍记 "S4"。

## 新增提示词 `prompts/stages/s4_extract.system.md`
- 任务：从一段**已清洗的课堂片段**提取结构化元数据，**不要输出清洗文本/正文**。
- 输出字段：key_points(3-8) / student_answer_kept / entities(persons/works/concepts复数键) / classics_candidates(篇名/作者/raw_span,只从给定文本摘取,禁止凭记忆补全) / review_flags(疑似人名/篇名/字词,只标不改)。
- 强调输出尽量短、只含元数据 JSON。
- `<PRESERVE>` 内文言文/诗词原样,不改。

## 边界
- 不改 schema(`$defs/chunkResult` 结构不变)、前端、S5-S10。
- 不照搬 demo 硬编码。用 P1 deterministic 模块,不重复实现清洗。不提交 git。

## 测试(mock LLM,不联网)
- mock 只返回元数据(无 cleaned_text 字段) → S4 组装出的 chunkResult.cleaned_text 来自确定性清洗(长度接近原文,~70-95%)、元数据来自 mock。
- 断言:不再有比例门重试(单块只 1 次 LLM 调用)。
- 现有 S4-S8 整链 mock 测试更新(S4 调用次数=chunk数;mock 改为返回元数据形态)。

## 验收
- `make check` 全绿。S4 单块只 1 次 LLM、输出小。
- chunkResult 仍合 schema;cleaned_text 非空且接近原文长度。

## 完成后
- `OUTBOX_CODEX.md`:S4 新数据流、cleaned_text 来源、LLM 元数据提示词、删了哪些重试逻辑、测试、make check 结果。
- `LOG.md` 追加:`[时间] CODEX: A1 S4保真确定性化+元数据 完成`。
