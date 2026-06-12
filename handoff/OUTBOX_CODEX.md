# OUTBOX · Codex · A2 chunk 级并发

## 改动范围

- 修改 `textcore/pipeline/stages/s4_clean.py`。
- 修改 `textcore/pipeline/stages/s7_versions.py`。
- 修改 `textcore/llm/client.py`。
- 更新 `tests/unit/test_pipeline_s4_s8.py`、`tests/unit/test_s7_versions.py`。
- 未改 schema、前端、S0-S3/S5/S6/S8/S9。
- 未提交 git。

## 并发实现

- S4 新增模块常量 `CONCURRENCY = 6`。
  - deterministic `cleaned_text` 仍先顺序生成，保证空清洗文本继续直接报错。
  - 每块 metadata LLM 调用通过 `ThreadPoolExecutor(max_workers=CONCURRENCY)` 提交。
  - future 完成后按原 chunk index 写回预分配结果数组，再按数组顺序返回。
- S7 新增模块常量 `CONCURRENCY = 6`。
  - faithful/study/outline 仍走确定性拼装。
  - concise 的逐块 LLM 润色通过线程池并发执行。
  - 空 `cleaned_text` chunk 保持旧行为：不发 concise LLM 调用。
  - S7 concise payload 额外带 `chunk_id`，便于定位和测试，不改输出 schema。

## 失败与顺序保证

- S4 单块 metadata LLM 异常不会中断整篇：
  - 该 chunk 保留 deterministic `cleaned_text`。
  - metadata 字段降级为空数组/空实体。
  - 仍记录一条 S4 zero-token `model_call`，模型为 `deepseek-v4-flash`。
- S7 单块 concise LLM 异常不会中断整篇：
  - 该 chunk 回退 deterministic `coverage_scaffold`。
  - 仍记录一条 S7 zero-token `model_call`，模型走 `llm_client.model_for("S7")`。
- S4/S7 都用 index 收集结果，不依赖 future 完成顺序；返回内容按原 chunk 顺序组装。

## 线程安全处理

- `LLMClient.provider` lazy 初始化增加窄锁，避免默认 provider 并发初始化竞态。
- `MockProvider.calls` append 增加锁保护；测试不依赖调用顺序。
- DeepSeekProvider 每次 `chat` 仍是独立 `httpx.post`，未引入共享请求状态。

## 测试

- 新增 S4 多 chunk 延迟 mock：并发完成顺序被打乱时，结果仍按 chunk 顺序返回。
- 新增 S4 单 chunk 异常 mock：失败 chunk metadata 降级，整篇不崩。
- 新增 S7 多 chunk 延迟 mock：concise 拼装顺序保持 chunk 原顺序。
- 新增 S7 单 chunk 异常 mock：失败 chunk 回退 scaffold，整篇不崩。
- 现有 S4-S8 mock 整链仍按 prompt 内容计数 S4/S7 调用。

## 验证

- `.venv/bin/python -m pytest tests/unit/test_pipeline_s4_s8.py tests/unit/test_s7_versions.py tests/unit/test_llm_client.py`：13 passed。
- `make check`：通过。
  - 前端 typecheck/lint 通过。
  - `scripts/check_api.py` 通过。
  - 全量 pytest：42 passed，1 个既有 StarletteDeprecationWarning。
