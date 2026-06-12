# INBOX · Codex · P3 S7 接入 concise/study/outline scaffold + 比例门 + 兜底

> 流水线融合 Phase 3。分支 `pipeline-fusion`。**改 `textcore/pipeline/stages/s7_versions.py` + 改/增测试**。
> 不动 schema、前端、API、其它 stage。**不提交 git**。结果写 `handoff/OUTBOX_CODEX.md`，`LOG.md` 追加一行。
> P1 模块可用：`deterministic.version_scaffold.build_chunk_scaffolds(...)`、`deterministic.quality_gates.check_version_ratio(...)`。P2 已让 S4 cleaned_text 有保真兜底。

## 现状与目标
当前 S7：faithful=拼装S4 cleaned_text；concise=逐块LLM；study=拼装key_points；outline=渲染tree/标题。
问题：concise 无逐块比例兜底（LLM 少给就掉到 18%）；study 太依赖 key_points 容易过短；outline 依赖 S6 tree 稀疏时无味。
本步用 P1 的确定性 scaffold 给三档加"覆盖基线 + 比例门 + 兜底"。

## 改造 `s7_versions.py`
对每个 chunk，先 `scaf = build_chunk_scaffolds(chunk_id=..., title=..., original_text=<该块原文>, cleaned_text=<S4 cleaned_text>, course_types=..., preserve_spans=...)`，得到该块四档基线。然后：

1. **faithful**：保持现状（拼装 S4 cleaned_text，已被 P2 兜底）。不变。
2. **concise（LLM 润色 + 比例门 + 兜底）**：
   - 仍逐块调 LLM，但 **user 输入加入 `coverage_scaffold = scaf["concise"]["body_md"]` 和 `hard_min_chars`**（约该块 cleaned_text 的 25%）。提示词任务从"自己摘要"改为"在 coverage_scaffold 覆盖范围上整理润色成段落，不得低于 hard_min_chars、不得漏掉 scaffold 主要讲解链条"。
   - LLM 返回后算该块 ratio = text_len(llm_concise)/text_len(cleaned_text)；用 `check_version_ratio`(version_key="concise", hard 0.22-0.45 这里按"对 cleaned_text 的占比"近似，或按对原文占比都可，注明口径)。
   - 若低于 hard_min（如 < 25%）：**回退 `scaf["concise"]["body_md"]`**。
   - 各块结果拼装为整篇 concise。
3. **study（确定性优先）**：直接拼装各块 `scaf["study"]["body_md"]`（不再只靠 key_points）。目标整篇 8%-12%。
4. **outline（确定性 + S6 合并）**：用各块 `scaf["outline"]["body_md"]` 拼装；若 S6 `outline_tree` 非空且更丰富，可合并其标题。目标 4%-7%。
5. char_count/compression 仍由代码真实计算、clamp≤1（现有 `_version`）。

## 更新 s7 提示词
- 改 `prompts/stages/s7_concise.system.md`：输入说明加入 `coverage_scaffold`、`hard_min_chars`，任务改为"在 scaffold 覆盖上润色成段，不得少于 hard_min_chars"。
- `s7_study.system.md` 本步不再被 S7 调用（study 走确定性），可保留文件备用。

## 边界
- 不改 schema、`$defs/version`。不动 S4/S5/S6/S8、前端、API。不提交 git。
- 用 P1 deterministic 模块，不重复实现抽取。

## 测试（mock LLM，不联网）
- mock concise 返回过短 → 该块回退 concise_scaffold；最终整篇 concise 占比 ≥ 0.25。
- mock concise 返回正常 → 用 LLM 结果，不回退。
- study/outline 为确定性：对一个构造的 chunk_results，断言整篇比例 study≈8-12%、outline≈4-7%、四档非空。
- 现有 S4-S8 整链 mock 测试更新断言（concise 调用次数=chunk 数；study/outline 不再调 LLM）。

## 验收标准
- `make check` 全绿。concise 有兜底、study/outline 确定性稳定。
- 四档 char_count 真实计算；versions 仍合 schema。

## 完成后
- `OUTBOX_CODEX.md`：S7 三档改造、concise 比例门口径、study/outline 确定性做法、提示词改动、调用次数变化、make check 结果、遗留。
- `LOG.md` 追加：`[时间] CODEX: P3 S7 scaffold+兜底 完成`。
