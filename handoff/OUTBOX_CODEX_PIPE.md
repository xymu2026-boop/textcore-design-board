# OUTBOX · Codex · T004 确定性流水线 S0-S3

## 已完成

- 新增 `textcore/pipeline/stages/s0_parse.py`：解析 `.docx` 段落，生成稳定 `pid/source_order`，抽取单独或行首的 `speaker/ts`，并从文件名/开头段落推断 `detected_meta`。
- 新增 `textcore/pipeline/stages/s1_preclean.py`：做空白/全半角规范化用于规则判断；OpenCC 可用时繁转简，不可用时跳过；输出课堂管理、点名、口头禅密集标签，不删除原文。
- 新增 `textcore/pipeline/stages/s2_segment.py`：规则版 mock `segment(paragraphs) -> segments`，不联网不调 LLM，后续可替换为轻量 LLM。
- 新增 `textcore/pipeline/stages/s3_chunk.py`：按边界和类型变化合并语义块，约 1500-3000 字；文言文/古诗词/作文原句进入 `must_preserve_spans`，连续保留段不拆开。
- 改造 `textcore/pipeline/runner.py`：S0-S3 用真实阶段产物，S4-S10 继续套 frozen example 占位，最终 `course_state` 仍经 `validate()`。
- 新增 `tests/unit/test_pipeline_s0_s3.py`：使用真实样本 `素材/五上-人文综合涵养-寒假-第三讲-隐显-偷钱+第四讲-文言文-醉叟传1.docx` 覆盖 S0-S3 和整体验证。

## 阶段输入输出

- S0 输入：`.docx` 路径和源文件名；输出：`paragraphs[]`、`source.detected_meta`。
- S1 输入：S0 `paragraphs[]`；输出：`preclean[]`，每段一个 `{pid, labels, risk?}`。
- S2 输入：S0 `paragraphs[]`；输出：`segments[]`，每段一个 `{pid, segment_type, is_boundary}`。
- S3 输入：S0 `paragraphs[]` + S2 `segments[]`；输出：`chunks[]`，含 `paragraph_range/context_before/primary_type/must_preserve_spans`。

## 真实样本结果

- 样本：`醉叟传1`
- paragraphs：179
- preclean 标记段：23
- segments：讲解 148、题目 16、作文点评 9、文言文原文 5、课堂管理 1
- chunks：17
- 保留约束：`c014` 覆盖 `p0146-p0161`，包含 5 个 `classical_text` span；连续文言文原文段保持在同一 chunk 内。

## 检查

- `make check`：通过
- pytest：10 passed, 1 warning
- warning 为 FastAPI/TestClient 的 StarletteDeprecationWarning，非本任务引入。

## 遗留

- 当前环境没有 `python-docx` / `opencc`；S0/S1 已做可选依赖处理。`python-docx` 可用时优先使用，不可用时用标准库 OOXML 兜底。
- S2 是规则 mock，边界和类型识别是保守启发式，后续可按同一 `segment(paragraphs) -> segments` 接口替换为轻量 LLM。
- S4-S10 仍是 example 占位，因此后段结果可能引用 example 的 chunk id；本任务只冻结并验证 S0-S3 真实产物。
