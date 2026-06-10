# OUTBOX · Codex · T002 后端存储 + API 最小闭环（假数据）

## 做了什么

- 新增 `textcore/storage/repository.py`：SQLite 课程投影仓库 + JSON course_state 单一真相读写。
- 新增 `textcore/pipeline/events.py`：内存 SSE 事件日志，可在处理期间推送，也可在完成后回放。
- 实现 `textcore/pipeline/runner.py` 假流水线：基于 `schemas/course_state.example.json` 生成合法 `course_state`，逐步发出 S0-S10 进度，最终落盘。
- 扩展 `apps/api/main.py`：保留 `/health`，新增上传、列表、详情、SSE、导出占位端点，并配置 CORS `http://127.0.0.1:5173`。
- 新增 `tests/integration/test_courses_api.py`：覆盖上传 -> 列表 -> 详情 validate -> SSE -> 导出。
- `apps/api/requirements.txt` 增加 `python-multipart`，支持 FastAPI multipart 上传。

## 表结构

SQLite 路径：`data/db/textcore.db`

表：`courses`

- `course_id TEXT PRIMARY KEY`
- `title TEXT NOT NULL`
- `teacher TEXT`
- `type TEXT`
- `status TEXT NOT NULL`
- `review_count INTEGER NOT NULL DEFAULT 0`
- `updated_at TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `state_path TEXT`
- `source_path TEXT`

索引：

- `idx_courses_updated_at`
- `idx_courses_status`

完整状态文件：`data/processed/<course_id>/course_state.json`

原始上传文件：`data/uploads/<course_id>/source.docx`

## 端点清单

- `GET /health`：健康检查。
- `POST /api/courses/upload`：接收 `.docx` multipart，返回 `{course_id}`，后台启动假流水线。
- `GET /api/courses`：返回 `course_list_item` 投影数组。
- `GET /api/courses/{course_id}`：读取完整 `course_state`，先调用 `textcore.contracts.course_state.validate()`。
- `GET /api/courses/{course_id}/events`：`text/event-stream`，推送/回放 S0-S10 status_event。
- `POST /api/courses/{course_id}/export`：返回占位 `.docx` 字节流。

## 检查结果

- `make check-api`：通过，`9 passed, 1 warning`。
- `make check`：未全绿，失败在当前工作树已有的前端文件：
  - `apps/web/src/api/client.ts(6,15): error TS2339: Property 'env' does not exist on type 'ImportMeta'.`
  - 本任务明确禁止修改 `apps/web/`，所以未修该前端类型问题。

## 手测结果

用临时 data 目录和 FastAPI `TestClient` 做了一次 API smoke：

- 上传 `manual.docx` 成功，返回 `course_2026_74318448`。
- `GET /api/courses` 返回 1 条课程，状态为 `completed`。
- `GET /api/courses/{id}` 返回完整状态，`contracts.validate()` 通过。
- `versions` 含 `faithful/concise/study/outline`，`default_version=concise`。
- `GET /api/courses/{id}/events` 收到 done 阶段：`S0,S1,S2,S3,S4,S5,S6,S7,S8,S9,S10`。
- `POST /api/courses/{id}/export` 返回 `.docx` 占位字节，内容以 `PK` 开头，长度 971 bytes。

## 遗留 / 需确认

- `make check` 的唯一阻塞来自 `apps/web/` 当前类型错误，需要前端任务或 Claude 侧处理。
- SSE 事件日志目前是内存态，服务重启后只保留 course_state 和列表投影，不回放历史事件；当前满足假流水线闭环，后续真实 runner 可替换为持久化事件表。
- 导出端点当前返回最小占位 `.docx`，后续 exporter 任务替换真实内容生成。
