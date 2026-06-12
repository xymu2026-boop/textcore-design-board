# OUTBOX · Codex · A2.2 版本切换 + 原文对照分块同步

## 改动范围

- 功能代码只改 `apps/web/src/App.tsx` 和 `apps/web/src/styles.css`。
- 未改 `apps/api`、`textcore`、schemas、prompts、`docs/prototype/`。
- 未引入硬编码业务数据。
- 未提交 git。

## 四档版本切换保位

- 详情页版本切换改为 `handleVersionChange()`，切换前记录当前 `activeChunkId`。
- 新版本正文渲染完成后，通过 `pendingScrollChunkRef` 定位回同一 C 段，避免每次切 tab 回到顶部。
- 左侧 C 段导航、顶部章节菜单、正文段间 `上一段` / `下一段` 继续共用同一个 `activeChunkId`。
- 对 chunk 锚点生成做了补强：若正文没有原生 `id=chunk_id`，优先按已有 `li` / `h2` 对齐；若版本正文的标题数少于 chunk 数，则按正文 DOM 子节点顺序近似分配到真实 chunk id，保证导航和保位仍可用。

## 原文对照分块同步

- 对照视图不再展示整篇原文或整篇当前版本。
- 左栏使用真实 API 字段：
  - `chunks[].chunk_id`
  - `chunks[].paragraph_range`
  - `paragraphs[].pid`
  - `paragraphs[].source_order`
  - `paragraphs[].speaker`
  - `paragraphs[].ts`
  - `paragraphs[].text`
- 左栏按当前 C 段的 `paragraph_range` 从 `paragraphs` 中筛出同段原始转写稿。
- 右栏使用当前选中版本的 `versions[version].body_md`，先转换/补齐为 chunk 锚点正文，再用当前 `activeChunkId` 只截取同一 C 段 HTML。
- 点击左侧章节栏、顶部章节菜单、段间导航时，正常阅读和对照视图都更新同一个 `activeChunkId`，左右栏同步切到同一块。
- 退出对照后回到正常阅读，当前版本和当前 C 段状态保留。

## 需要后端补字段

- 当前 schema 只有 `versions[version].body_md` 整体正文，没有每个版本的显式 chunk 分节结构。
- 对于已经按 chunk 分节或标题数量与 chunk 数一致的版本，前端可精确截取同 C 段。
- 对于正文没有 chunk 锚点、且标题数量少于 chunk 数的版本，前端只能按 DOM 顺序近似分配。若要完全精确，需要后端补充类似：
  - `versions[version].chunks[] = { chunk_id, body_md }`
  - 或在 `versions[version].body_md` 内稳定输出 `<section id="{chunk_id}">...</section>`。

## 与 demo 差异

- demo 数据内置 `chunk.rawHtml` 和版本 HTML chunk section；React 版只使用真实 API 数据。
- React 版的原文左栏由 `paragraphs + paragraph_range` 实时生成，不使用 demo 的内置原文 HTML。
- 后端未提供版本分块字段时，React 版会尽力按已有正文结构近似切分，并已在上方记录字段缺口。

## 验证

- `cd apps/web && npm run check`：通过。
- `cd apps/web && npm run build`：通过。
- 浏览器视觉检查：本会话沙箱拒绝 dev server 监听，`npm run dev` 报 `listen EPERM: operation not permitted ::1:5173`；改用 `npx vite --host 127.0.0.1 --port 5174` 仍被拒绝 `listen EPERM`。
