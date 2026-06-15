# OUTBOX · Codex · ④ 处理进度可视化

## 改动范围

- 修改 `textcore/pipeline/events.py`：SSE broker 改为线程安全发布，`make_status_event()` 支持可选 `chunk_index` / `chunk_total`。
- 修改 `textcore/pipeline/runner.py`：S4 / S7 通过 runner 侧 LLM client 包装器发布 chunk 级进度事件；S4 / S7 阻塞 stage 调用放入 `asyncio.to_thread()`，避免事件循环被长任务卡住。
- 修改 `schemas/api/status_event.schema.json`：新增可选 `chunk_index` / `chunk_total` 属性，未改 `required`。
- 修改 `apps/web/src/App.tsx`、`apps/web/src/api/types.ts`、`apps/web/src/styles.css`：前端继续按现有 SSE 消费事件，并在进度步骤下显示如 `清洗 3/12 块` / `精简 3/12 块` 的细粒度信息。
- 新增/更新测试：`tests/unit/test_pipeline_events.py`、`tests/unit/test_pipeline_s4_s8.py`、`tests/integration/test_courses_api.py`。
- 未改 `course_state` schema、deterministic、classics、各 stage 内部逻辑；未提交 git。

## 事件结构

新增字段均为可选：

```json
{
  "stage": "S4",
  "stage_status": "running",
  "progress": 0.36,
  "message": "清洗 3/12 块",
  "chunk_index": 3,
  "chunk_total": 12
}
```

- S4 chunk 事件 message 使用 `清洗 x/y 块`。
- S7 chunk 事件 message 使用 `精简 x/y 块`。
- `progress` 按当前大阶段区间内的 `chunk_index / chunk_total` 线性推进，阶段 done 事件仍保持原有结构。

## 线程安全处理

- `StatusEventBroker` 使用 `threading.Condition` 存储和唤醒 SSE stream，新增 `publish_threadsafe()`。
- runner 侧 `_ChunkProgressLLMClient` 在 worker thread 的 `complete_json()` 结束后用锁递增完成计数并发布事件。
- S4 / S7 stage 本身仍保持线程池并发；runner 未改 stage 内部逻辑。

## Partial 状态

- 每个大阶段完成后写入：
  - `data/processed/<course_id>/partial/<stage>.json`
- partial 文件是诊断快照，不进入正式 schema，不影响 `course_state.json`。
- 内容包含当前阶段、source、已生成的 paragraphs/chunks/chunk_results/versions/assets/review_flags/quality 以及 processing_log。

## 测试与验证

- `tests/unit/test_pipeline_events.py`
  - 校验 status event schema 接受可选 chunk 字段。
  - 校验并发线程发布 chunk 事件时 broker stream 不丢事件、不崩。
- `tests/unit/test_pipeline_s4_s8.py`
  - mocked pipeline 跑出 S4 / S7 chunk 事件。
  - 校验 partial/S7.json 写入。
- `tests/integration/test_courses_api.py`
  - API SSE stream 中包含 S4 / S7 chunk 事件。
- 已运行 `make check`：通过。
  - web typecheck/lint：通过。
  - backend API/Ruff check：通过。
  - pytest：50 passed，1 个既有 `StarletteDeprecationWarning`。
