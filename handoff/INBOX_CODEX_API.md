# INBOX · Codex · T002 后端存储 + API 最小闭环（假数据）

> 你是文心 TextCore 主力开发。本任务只做后端，**不碰 `apps/web/`**。
> 结果写 `handoff/OUTBOX_CODEX_API.md`，并在 `handoff/LOG.md` 追加一行。不提交 git。

## 目标
不接真实 LLM，先让"上传→处理→列表→详情→进度→导出占位"全链路用真实 API + 假数据跑通。

## 必读（仓库内，契约已冻结，严格遵守）
- `schemas/course_state.schema.json`（全量契约）
- `schemas/course_state.example.json`（一份合法示例，假流水线直接拿它当产出）
- `schemas/api/course_list_item.schema.json`、`schemas/api/status_event.schema.json`
- `textcore/contracts/course_state.py`（用 `validate()` 卡门、`VERSION_KEYS`/`DEFAULT_VERSION` 常量）
- `00_产品设计/开发计划/TextCore_正式开发框架与AI协作计划_v0.1.md`（Phase 1/2）

## 范围
1. **存储层** `textcore/storage/`：
   - SQLite（路径 `data/db/textcore.db`）。表 `courses`：索引投影列（course_id, title, teacher, type, status, review_count, updated_at, created_at）。
   - 完整 course_state 以 JSON 落盘 `data/processed/<course_id>/course_state.json`（单一真相），SQLite 只存列表所需投影 + 指针。
   - 原始上传存 `data/uploads/<course_id>/source.docx`。
   - repository 层：create_course / save_state / get_state / list_courses / update_status。
   - migration：建表脚本（启动时自动建表即可，先不引入 alembic）。
2. **FastAPI** `apps/api/`（保留现有 `/health`）：
   - `POST /api/courses/upload`：接收 .docx（multipart），生成 course_id，存文件，建课程，启动**假流水线**（后台任务），返回 `{course_id}`。
   - `GET /api/courses`：返回 `course_list_item` 数组。
   - `GET /api/courses/{id}`：返回完整 course_state（先做 `validate()` 再返回）。
   - `GET /api/courses/{id}/events`：SSE，按 `status_event` schema 逐条推送 S0→S10 进度。
   - `POST /api/courses/{id}/export`：返回一个占位 .docx（字节流，可后续替换）。
3. **假流水线** `textcore/pipeline/`（占位 runner）：
   - 不调 LLM。以 `course_state.example.json` 为模板，套用本课 course_id/source，分阶段把 status 从 created→processing→completed 推进。
   - 每阶段 sleep 极短（如 0.3s）模拟，逐步 emit SSE 进度。最终落盘合法 course_state。
4. **CORS**：允许 `http://127.0.0.1:5173`（前端 dev）。

## 不做
- 不接真实 LLM、不实现真实 S0–S10 逻辑（那是后续阶段）。
- 不碰 `apps/web/`、`schemas/`、`textcore/contracts/`、`ai/`、`docs/`、`00_产品设计/`、`素材/`。
- 不提交 git。

## 验收标准
- `make check` 全绿（新增后端单测：上传→列表→详情；detail 通过 `contracts.validate()`）。
- 手测：上传一个 .docx → `GET /api/courses` 能看到 → 详情返回合法 course_state → events 能收到 S0..S10 进度 → export 返回 .docx 字节。
- 详情返回的 versions 含 faithful/concise/study/outline，default_version=concise。

## 完成后
- `OUTBOX_CODEX_API.md` 写：做了什么、表结构、端点清单、make check 结果、手测结果、遗留/需确认。
- `LOG.md` 追加：`[时间] CODEX: T002 后端存储+API 完成`。
