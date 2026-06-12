# INBOX · Codex · A2 chunk 级并发（S4 元数据 + S7 精简 并行）

> 分支 `pipeline-fusion`。**改 `textcore/pipeline/stages/s4_clean.py`、`s7_versions.py`、`textcore/llm/client.py`(如需) + 测试**。不动 schema、前端。**不提交 git**。结果写 OUTBOX，LOG 追加。

## 背景与目标
A1 后单块 S4 ~10-17s，但 13 块仍**串行** = 2-4 分钟；S7 精简也是逐块串行。本步把 chunk 级 LLM 调用**并发**执行，预计整篇再快 5-6×，冲 1-3 分钟。

## 技术要点
- LLM 调用 `complete_json` 是**同步阻塞**(httpx.post)。在并发里用线程池跑同步调用：`asyncio.to_thread` 或 `concurrent.futures.ThreadPoolExecutor`。
- runner(`run_fake_pipeline`) 是 async；s4_clean.run / s7_versions.run 当前是同步函数内部 for 循环。
- 改造方式（择一，保持对外签名稳定）：
  - 在 s4_clean.run / s7_versions.run 内部，用 `ThreadPoolExecutor(max_workers=CONCURRENCY)` 把"每块一次 LLM 调用"并发提交，按原顺序收集结果。
  - 或提供 async 版本由 runner await。优先**线程池内部并发**，对外签名不变，改动最小。
- **并发上限** `CONCURRENCY=6`（放模块常量，避免触发 DeepSeek 限流）。
- 保持结果**按 chunk 原顺序**组装（用索引收集，不靠完成顺序）。
- 保留每块的 model_calls 记录（顺序不重要，数量对即可）。
- 失败处理：单块 LLM 失败按现有逻辑（A1 的元数据失败→该块元数据置空但 cleaned_text 仍在；S7 concise 失败→回退 scaffold）。并发下单块异常不能让整篇崩，用 try/except 包每块。

## 范围
1. `s4_clean.run`：13 块的元数据 LLM 调用并发(线程池, max 6)，cleaned_text(确定性)可并发或顺序(很快)。
2. `s7_versions.run`：concise 逐块 LLM 润色并发(线程池, max 6)。study/outline 确定性不涉及。
3. 若 `LLMClient`/provider 非线程安全，在 client 加最小锁或每线程独立 provider（DeepSeekProvider 用 httpx，每次新建请求，应线程安全；tenant token 无）。确认 MockProvider 在测试并发下 calls 记录用锁保护或测试改为不依赖调用顺序。

## 边界
- 不改 schema、前端、S0-S3/S5/S6/S8/S9 逻辑。不提交 git。
- 对外函数签名尽量不变(runner 调用处不改或最小改)。

## 测试(mock LLM,不联网)
- 现有 S4-S8 整链 mock 测试仍过（并发后调用次数不变，但 provider.calls 顺序可能变——把依赖顺序的断言改为按内容计数 `_count_prompt_calls`）。
- 新增：构造多块(如5块)，mock 每块返回不同内容，断言并发后结果**按 chunk 顺序**正确组装(不串位)。
- 单块异常 mock → 整篇不崩，该块降级。

## 验收
- `make check` 全绿。
- 我会真跑整篇验证耗时(目标 1-3 分钟)与四档比例(保持~90/31/9/5)。

## 完成后
- `OUTBOX_CODEX.md`：并发实现方式、并发上限、线程安全处理、顺序保证、测试、make check 结果。
- `LOG.md` 追加：`[时间] CODEX: A2 chunk级并发 完成`。
