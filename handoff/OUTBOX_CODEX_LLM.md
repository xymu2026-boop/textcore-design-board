# OUTBOX · Codex · T005 LLM 流水线 S4-S8

## 提示词清单
- `prompts/rules/colloquial_cleaning.md`
- `prompts/rules/classics_protection.md`
- `prompts/rules/essay_feedback.md`
- `prompts/stages/s4_clean.system.md`
- `prompts/stages/s6_merge.system.md`
- `prompts/stages/s7_versions.system.md`
- `prompts/stages/s8_cards.system.md`
- `prompts/stages/s8_materials.system.md`

## 接线
- 新增 `textcore/pipeline/prompts.py`：加载 stage prompt，并追加规则文件。
- 新增 `textcore/pipeline/llm_stage.py`：封装 `$defs`/property schema、model call 日志、chunk 原文拼装、`<PRESERVE>` 拼装。
- 新增 `textcore/pipeline/stages/s4_clean.py`：逐 chunk 调 `LLMClient.complete_json(..., stage="S4")`，输出并校验 `chunkResult`。
- 新增 `textcore/pipeline/stages/s5_classics.py`：收集 S4 `classics_candidates`，补 `chunk_id/ref_id`，调用 `ClassicsService.lookup_candidates`。
- 新增 `textcore/pipeline/stages/s6_merge.py`：全局合并，输出 `global`。
- 新增 `textcore/pipeline/stages/s7_versions.py`：一次生成 `faithful/concise/study/outline` 四档版本。
- 新增 `textcore/pipeline/stages/s8_extract.py`：分别抽取 `knowledge_cards` 和 `writing_materials`。

## Runner 改动
- `run_fake_pipeline` 保留原函数名兼容 API，但 S4/S6/S7/S8 已接入 `LLMClient`，S5 接入 `ClassicsService`。
- Runner 新增可注入参数：`llm_client`、`classics_service`，测试可传 `MockProvider`，真实跑可传默认/真实 provider 的 `LLMClient`。
- `processing_log.model_calls` 记录 S4/S6/S7/S8 的 model 与 token；`processing_log.cost.total_tokens` 汇总 token。
- S9 先做确定性汇总：聚合 S4/S6 review flags 与 S5 diffs，并生成基础 `quality`。
- 最终保存前仍调用 `validate(state)`。

## 测试
- 新增 `tests/unit/test_pipeline_s4_s8.py`：用 `MockProvider` + 本地 seed classics DB 跑完整 runner S0-S10，覆盖 S4-S8 接线；断言 `validate()`、四档版本、cards/materials、`classics_refs` 命中服务。
- 更新 `tests/integration/test_courses_api.py`：API 集成测试通过 monkeypatch 注入 `MockProvider`，避免沙箱真实调 LLM。
- `make check` 结果：通过。19 passed，1 个现有 Starlette deprecation warning。

## 真实 Client 跑法
Claude/真实环境可传真实 provider：

```python
from textcore.llm import LLMClient
from textcore.pipeline.runner import run_fake_pipeline

await run_fake_pipeline(
    repository=repo,
    events=events,
    course_id=course_id,
    source_filename=filename,
    source_path=source_path,
    llm_client=LLMClient(),
)
```

需要有效 `DEEPSEEK_API_KEY`，并确保 `data/classics/gushiwen.sqlite` 已构建。

## 遗留
- 函数名仍为 `run_fake_pipeline`，为兼容现有 API；后续可单独重命名并改 API import。
- S9/S10 仍是轻量确定性汇总/保存，没有做完整质量审计与导出增强。
- 真实模型输出效果未跑；本任务按要求只做 MockProvider 离线验证。
