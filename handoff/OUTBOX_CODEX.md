# OUTBOX · Codex · ③ 知识资产聚合

## 改动范围

- 新增 `textcore/assets/aggregate.py` 与 `textcore/assets/__init__.py`。
- 修改 `apps/api/main.py`，新增只读聚合端点。
- 修改 `apps/web/src/App.tsx`、`apps/web/src/api/client.ts`、`apps/web/src/api/types.ts`、`apps/web/src/styles.css`，资产页接真实 API 数据。
- 新增测试：`tests/unit/test_assets_aggregate.py`、`tests/integration/test_assets_api.py`。
- 未改 `course_state` schema，未动 `textcore/pipeline/runner.py`、`textcore/pipeline/stages/`、`textcore/pipeline/deterministic/`，未提交 git。

## 聚合逻辑

- `aggregate_assets_from_repository(repo)` 从 `repo.processed_dir/*/course_state.json` 读取所有可解析状态文件。
- `aggregate_assets(states)` 纯聚合传入的 state dict：
  - `cards`: 汇总所有 `knowledge_cards`，保留 `type`，按 `method/person/event/concept/work/theme/mistake` 顺序输出。
  - `materials`: 汇总所有 `writing_materials`。
  - `vocab`: 临时从聚合后的 `knowledge_cards` 中筛 `type in {"concept", "work"}`。
- 每个资产项都有 `source: {course_id, course_title}`；课程名取 `source.detected_meta.course_title`，否则回退到 `source.file`/`course_id`。
- 去重规则：同一 `title` 规范化后 + 同一 `course_id` 合并；列表字段如 `core_points/source_chunks/theme` 做稳定去重合并。
- `writing_materials.source` 原本是素材出处字符串；聚合投影中保留为 `material_source`，统一把 `source` 用作课程来源对象。
- 读取 processed 目录时跳过不可解析 JSON，避免后台批处理写入中的单个半文件打断整个资产页。

## API 形状

- 新增 `GET /api/assets`。
- 返回：

```json
{
  "cards": [
    {
      "card_id": "...",
      "title": "...",
      "type": "method",
      "source": { "course_id": "...", "course_title": "..." }
    }
  ],
  "materials": [
    {
      "material_id": "...",
      "title": "...",
      "material_source": "课堂阅读讲评",
      "source": { "course_id": "...", "course_title": "..." }
    }
  ],
  "vocab": [
    {
      "card_id": "...",
      "title": "...",
      "type": "concept",
      "source": { "course_id": "...", "course_title": "..." }
    }
  ]
}
```

## 前端渲染

- 资产页 `/assets` 挂载时调用 `getAssets()`。
- 三个 Tab：
  - 方法卡片库：渲染全部 `cards`，按 `type` 分组展示。
  - 词汇生词本：渲染 `vocab`。
  - 佳句素材册：渲染 `materials`。
- 顶部显示聚合数量，支持“刷新资产”。
- 加载失败显示可重试错误态。
- 当前 Tab 无数据时显示友好空态，并保留已完成/待复核课程入口。
- 每张卡的“来源课程”按钮跳转 `/courses/{course_id}`。

## 测试与验证

- 新增聚合单测覆盖：跨课程来源、同标题同课程去重、列表字段合并、素材 `material_source` 投影、vocab 临时来源、tmp processed 目录读取。
- 新增 API 测试覆盖：temp `CourseRepository` fixture 写入 course_state 后请求 `GET /api/assets`，不依赖实时 `data/processed`。
- 已运行 `make check`：通过。
  - web typecheck/lint：通过。
  - backend ruff：通过。
  - pytest：48 passed，1 个既有 `StarletteDeprecationWarning`。
- 追加运行 `cd apps/web && npm run build`：通过。
- 尝试本地浏览器 smoke：`make dev` 在当前沙箱无法绑定 `127.0.0.1:5173`，Vite 报 `EPERM`；因此未完成 Browser 页面目测验证。

## 遗留

- 词汇生词本仍是临时投影：只从 `knowledge_cards` 的 `concept/work` 类型生成；未来如 schema 增加专门词汇字段，可替换该来源。
- `GET /api/assets` 当前是文件扫描聚合，没有分页/搜索；后续资产规模扩大后可再加索引或查询参数。
- `make dev` 现有命令在 `apps/api` 目录启动 `main:app` 时没有仓库根在 `PYTHONPATH`，本次尝试暴露为 `ModuleNotFoundError: No module named 'textcore'`；本任务未修改 Makefile。
