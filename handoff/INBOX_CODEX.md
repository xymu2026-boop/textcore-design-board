# INBOX · Codex · ④ 处理进度可视化（chunk 级 SSE 事件 + partial 状态）

> 分支 `pipeline-fusion`。碰 `textcore/pipeline/runner.py`、`textcore/pipeline/events.py`、`apps/web`(进度展示) + 测试。**不动 schema、deterministic、classics、各 stage 内部逻辑**。**不提交 git**。结果写 OUTBOX，LOG 追加。
> 批处理已跑完，runner 可安全修改。

## 背景
单篇处理现在 ~6-7min，但前端只显示 S0-S10 粗粒度阶段。本步让长任务能看到"第几块/共几块"的细粒度进度，体验更好。

## 范围
1. **runner 发 chunk 级事件**：S4(逐块清洗)、S7(逐块精简) 时，每完成一块通过 events 发一条进度事件，含 `stage` / `chunk_index` / `chunk_total` / `message`(如"清洗 3/12 块")。整体 `progress` 0-1 更平滑。
   - 注意：S4/S7 是线程池并发，事件回调需线程安全（events 用锁，或回调里加锁）。
2. **events.py**：支持 chunk 级事件字段（不破坏现有 status_event 结构；新增字段可选）。**不改 schemas/api/status_event.schema.json 的必填项**，新增字段设为可选。
3. **前端**：进度区显示当前阶段 + "x/y 块"细粒度；不破坏现有 SSE 消费。
4. （可选）partial state：每个大阶段后写 `data/processed/<cid>/partial/<stage>.json`，便于中途失败定位。**不进正式 schema**。

## 不做 / 边界
- 不动 course_state schema 必填、不动 deterministic/classics/各 stage 处理逻辑。
- 不引入硬编码数据。不提交 git。

## 验收
- `make check` 全绿（events/runner 测试更新；并发下事件不串/不崩）。
- 真实/ mock 跑能产出 chunk 级事件；前端能显示 x/y 块。

## 完成后
- `OUTBOX_CODEX.md`：事件结构、线程安全处理、前端展示、partial 方案、测试、make check 结果。
- `LOG.md` 追加：`[时间] CODEX: ④ 进度可视化 完成`。
