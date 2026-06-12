# INBOX · Codex · P2 S4 接入 faithful scaffold + 比例门 + 重试 + 兜底

> 流水线融合 Phase 2。分支 `pipeline-fusion`。**改 `textcore/pipeline/stages/s4_clean.py` + 新增/改测试**。
> 不动 schema、前端、API、其它 stage。**不提交 git**。结果写 `handoff/OUTBOX_CODEX.md`，`LOG.md` 追加一行。
> P1 已完成：`textcore/pipeline/deterministic/`（transcript_cleaner / sentence_ranker / version_scaffold / quality_gates）可直接用。

## 要解决的问题
S4 当前只校验 schema，不校验保真清洗的长度比例。LLM 把清洗做成摘要时（cleaned_text 远短于原文），没有兜底，后续 S7 无法恢复被删的讲解。本步加"比例门 + 重试 + 确定性兜底"。

## 改造 `s4_clean.py`（保持现有签名/返回结构不变）
对每个 chunk：
1. 取该 chunk 的原文：用现有 `llm_stage.paragraph_text_for_chunk(chunk, paragraphs)`。原文字数 = `original_chars`。
2. 正常调 LLM 得到 `cleaned_text`（现有逻辑），算 `ratio = text_len(cleaned_text)/original_chars`。
3. **比例门**（用 `deterministic.quality_gates.check_version_ratio`，version_key="faithful"，preferred 0.85-0.93/hard 0.70-0.95）：
   - ratio ≥ 0.70：接受。
   - ratio < 0.70：**重试一次**，user 末尾追加："你上次输出过度摘要（只剩 {ratio:.0%}）。保真清洗不是摘要，请逐句保留老师讲解，保留原文 70%-90%。" 重试后再算 ratio。
   - 仍 < 0.70：**回退确定性兜底**——调 `deterministic.version_scaffold.build_chunk_scaffolds(...)` 取 `faithful` 的 body_md 作为 cleaned_text，并向该 chunk 的 `review_flags` 追加：
     `{"flag_id":..., "text":"", "reason":"S4 LLM 输出低于保真比例(<70%)，已回退确定性保真清洗", "category":"other", "severity":"medium", "status":"open"}`
     （注意 reviewFlag 必填 text+reason，text 可填简短说明如"保真清洗兜底"。）
4. 记录每 chunk 的 model_calls（重试算 2 次）。preserve_spans（chunk.must_preserve_spans）传给 scaffold。

## 边界
- 不改 schema、`$defs/chunkResult` 结构；cleaned_text 仍是字符串。
- 不动 S5-S10、前端、API。不照搬 demo 硬编码。不提交 git。
- 兜底用 P1 的 deterministic 模块，不要重复实现清洗逻辑。

## 测试（`tests/unit/test_pipeline_s4_s8.py` 或新增，mock LLM，不联网）
- mock provider 第一次返回**过短** cleaned_text（如原文 10%）→ S4 触发重试。
- 重试仍返回过短 → S4 回退确定性 faithful scaffold，且该 chunk 出现 pipeline_fallback 类 review_flag、cleaned_text 长度 ≥ 原文 70%。
- mock provider 返回正常长度（≥70%）→ 不重试不兜底，正常通过。
- 现有 S4-S8 整链 mock 测试仍要过（调用次数变化就更新断言）。

## 验收标准
- `make check` 全绿。S4 过短场景能重试→兜底；正常场景不受影响。
- 兜底后 chunk_results 仍合 schema，含 pipeline_fallback review_flag。

## 完成后
- `OUTBOX_CODEX.md`：S4 改造点、比例门/重试/兜底逻辑、测试用例、调用次数变化、make check 结果、遗留。
- `LOG.md` 追加：`[时间] CODEX: P2 S4比例门+兜底 完成`。
