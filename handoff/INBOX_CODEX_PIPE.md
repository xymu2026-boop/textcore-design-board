# INBOX · Codex · T004 确定性流水线 S0–S3

> 你是文心 TextCore 主力开发。本任务做确定性流水线前段，**只碰 `textcore/pipeline/`**（及其 stages 子目录）与 `tests/`。
> 不碰 `apps/`、`textcore/classics/`、`textcore/contracts/`、`schemas/`。
> 结果写 `handoff/OUTBOX_CODEX_PIPE.md`，`handoff/LOG.md` 追加一行。不提交 git。

## 目标
把 S0–S3 做成真实确定性实现（不调 LLM），产出符合契约的 paragraphs/preclean/segments/chunks。
替换假流水线里 S0–S3 这段；S4 起仍可保留占位（套 example），保证整体仍产出合法 course_state。

## 必读
- `schemas/course_state.schema.json` 的 `paragraph` / `preclean` / `segments`(segmentType) / `chunk`(must_preserve_spans) 定义
- `textcore/contracts/course_state.py`（validate / STAGES）
- `textcore/pipeline/runner.py`、`events.py`（现有假流水线，在其上改造）
- 真实样本：`素材/*.docx`（如 醉叟传1、第七讲 阅读+作文）

## 范围（每阶段一个函数，落 `textcore/pipeline/stages/`）
1. **S0 解析** `s0_parse.py`：用 `python-docx` 读 .docx 段落 → `paragraphs[]`，每段 `pid`(p0001..)、`source_order`。
   - 正则抽 `speaker` + `ts`（样本形如「陈细影 00:00:09」单独成段或行首）。
   - `detected_meta`：从文件名/前几段正则猜 course_title/teacher/student_group。
2. **S1 预清洗** `s1_preclean.py`：统一空白/全半角标点；正则给课堂管理（“安静一下/谁来读/看屏幕”）、点名、口头禅密集段打 `labels`，写 `preclean[]`（标记不删原文）。
   - 繁简转换用 OpenCC **可选**：若 `opencc` 不可用则跳过，不要硬依赖。
3. **S2 话题分割** `s2_segment.py`：本应是轻量 LLM，**现在先做规则版 mock**（基于 speaker 连续性、标点、关键词、题号）输出每段 `segment_type` + `is_boundary`。
   - 留一个清晰的接口 `segment(paragraphs) -> segments`，注明“后续替换为 LLM”。不要真的调网络。
4. **S3 语义分块** `s3_chunk.py`：按 segment_type 变化点 + is_boundary 合并成 ~1500–3000 字的 `chunks[]`。
   - 硬约束：`文言文原文`/`古诗词`/作文原句段不被切断 → 进 `must_preserve_spans`。
   - 每块带 `context_before`（上一块尾部摘要，可简单截取）、`paragraph_range`、`primary_type`。

## 不做
- 不调 LLM、不联网。S2 用规则 mock。
- 不碰 apps/、classics/、contracts/、schemas/、docs/、00_产品设计/、素材/（只读）。
- 不提交 git。

## 验收标准
- `make check` 全绿，新增 `tests/unit/test_pipeline_s0_s3.py`：用一个真实 `素材/*.docx`，断言 paragraphs 非空且每段有 pid、chunks 数量合理（几十段→数块）、文言文/古诗词段未被切断、产出经 `contracts.validate()`（整体 state 仍合法）。
- 跑通后 course_state 的 paragraphs/segments/chunks 为真实数据，S4+ 仍可占位。

## 完成后
- `OUTBOX_CODEX_PIPE.md`：做了什么、各阶段输入输出、对真实样本的分块结果（段数/块数）、make check 结果、遗留。
- `LOG.md` 追加：`[时间] CODEX: T004 S0-S3 完成`。
