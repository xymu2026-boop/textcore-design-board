# INBOX · Codex · T005 LLM 流水线 S4–S8（提示词 + 接线）

> 你是文心 TextCore 主力开发。本任务做 LLM 流水线 S4–S8 的提示词资产 + 接线，**只碰 `prompts/`、`textcore/pipeline/`、`tests/`**。
> 不碰 `textcore/llm/`(适配器已就绪)、`textcore/classics/`(服务已就绪)、`textcore/contracts/`、`schemas/`、`apps/`。
> **沙箱无网络：不要真实调 LLM。用 MockProvider 写单测。真实跑由 Claude 做。**
> 结果写 `handoff/OUTBOX_CODEX_LLM.md`，`handoff/LOG.md` 追加一行。不提交 git。

## 目标
把流水线从"S4+ 套 example 占位"升级为真实 LLM 处理：S4 分块清洗 → S5 古文查证(已就绪) → S6 全局合并 → S7 四档版本 → S8 卡片/素材。

## 必读（仓库内）
- `00_产品设计/技术方案/TextCore_内容处理流水线实现方案_v0.2.md`（§4 各阶段定义、§5 古文规则、§6.2 提示词模板范例、作文点评规则）
- `schemas/course_state.schema.json` 的 $defs：chunkResult / classicsRef / version / knowledgeCard / writingMaterial / quality / outlineNode
- `textcore/llm/client.py`：`LLMClient.complete_json(system,user,schema,*,stage,model,max_retries)`→(dict,LLMResult)；`MockProvider(handler)`；`STAGE_MODEL`
- `textcore/contracts/course_state.py`：`validate` / `validate_subschema(obj, def_name)`
- `textcore/classics/service.py`：`ClassicsService().lookup_candidates(candidates)`→classics_refs
- `ai/decisions/ADR-004-version-tiers.md`：四档 key 与压缩率（faithful≈90%/concise≈31%默认/study≈9%/outline≈5%）

## 范围
### A. 提示词资产 `prompts/`
- `rules/colloquial_cleaning.md`：口语清洗规则（去口头禅/课堂管理/重复，保留讲解主线、必要学生回答）。
- `rules/classics_protection.md`：文言文/诗词保护（<PRESERVE>原样输出、禁止凭记忆补全、不确定进 review_flags、原文以 canonical 为准不静默改）。
- `rules/essay_feedback.md`：作文点评保留（原句-问题-修改方向-可迁移方法，不得压缩到失去老师判断）。
- `stages/s4_clean.system.md`：分块保真清洗，输出符合 $defs/chunkResult（cleaned_text/key_points/student_answer_kept/review_flags/entities/classics_candidates）。include 上面 rules。
- `stages/s6_merge.system.md`：全局合并，输出 course_summary/outline_tree/main_themes/merged_review_flags。
- `stages/s7_versions.system.md`：生成四档（按 ADR-004 浓度），正文 Markdown。可分档调用或一次产四档。
- `stages/s8_cards.system.md` / `s8_materials.system.md`：知识卡片 / 作文素材，符合对应 $defs。
- 提示词不含数据：规则写模板里，运行时把"当前块原文 + context_before + must_preserve_spans"作为 user 拼入。

### B. 接线 `textcore/pipeline/stages/`
- `s4_clean.py`：对每个 chunk 调 `LLMClient.complete_json(..., stage="S4")`，产 chunk_results。must_preserve_spans 用 `<PRESERVE>...</PRESERVE>` 包进 user。
- `s5_classics.py`：收集各 chunk_results 的 classics_candidates（补 chunk_id），调 `ClassicsService.lookup_candidates`，写 course_state.classics_refs。
- `s6_merge.py` / `s7_versions.py` / `s8_extract.py`：同上模式，stage 分别 S6/S7/S8。
- `runner.py`：把 S4–S8 接成真实阶段（接受一个注入的 LLMClient，便于测试传 MockProvider）；S5 在 S4 与 S6 之间。仍保证最终 course_state 经 `validate()`。
- 每阶段把 LLMResult 的 token 计入 processing_log.model_calls。

## 不做
- 不真实联网调 LLM（沙箱会失败）。用 MockProvider 注入假返回写测试。
- 不碰 llm/、classics/、contracts/、schemas/、apps/、docs/、00_产品设计/、素材/。
- 不提交 git。

## 验收标准
- `make check` 全绿。新增 `tests/unit/test_pipeline_s4_s8.py`：用 MockProvider 给每阶段喂合法假 JSON，跑通 S4→S8，断言最终 course_state 经 `validate()`，versions 四档齐全、有 cards/materials、classics_refs 来自服务。
- runner 支持注入 LLMClient（真实 key 时 Claude 能换真 provider 跑）。

## 完成后
- `OUTBOX_CODEX_LLM.md`：提示词清单、各阶段接线、runner 改动、测试、如何用真实 client 跑、遗留。
- `LOG.md` 追加：`[时间] CODEX: T005 LLM流水线S4-S8 完成`。
