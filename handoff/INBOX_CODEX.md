# INBOX · Codex · A2.3 资源联动 + 旁征博引浮层

> 前端收尾步骤 4。**只碰 `apps/web/`**。结果写 `handoff/OUTBOX_CODEX.md`，`LOG.md` 追加一行。**不提交 git**。
> 当前分支 `frontend-polish`。对照黄金参照 `docs/prototype/`（`app.js`/`styles.css`，只读）。

## 背景
A2.1/A2.1b/A2.2 已完成（三栏骨架 + 阅读导航 + 版本切换 + 原文对照同步，用户认可）。本步做详情页的**精细交互层**：资源（知识卡/作文素材/复核）联动 + 古文旁征博引浮层 + 复核标记微交互。对照 demo 还原。

## 范围（只动 apps/web，行为参照 docs/prototype/app.js）
1. **旁征博引浮层（对照 demo）**
   - 课程知识卡区/正文中的**作品篇名、作者**（如《醉叟传》《偷钱》、袁宏道）做成可点元素；点击弹出浮层，展示该作品的**原文 + 译文 + 注释 + 赏析 + 来源**。
   - 数据来源：course_state 的 `classics_refs[]`（canonical_text/translation/remark/shangxi/ref_url/matched）。matched=false 的显示"未匹配权威原文"。
   - 浮层含"展开详案/查看全文"入口（参照 demo 的"作品旁征博引"卡）。
2. **复核标记微交互**
   - 正文里的疑似错字/人名/篇名复核标记：**灰色低干扰下划线/括注**，hover 弹小气泡显示 `review_flags[]` 的 reason/suggestion（如"罪首→醉叟"）。不要刺眼红色。
   - 右侧"复核"列表项点击可定位到正文对应位置（有 pid 时）。
3. **资源联动**
   - 右侧"知识卡片/作文素材/复核"面板：点卡片可展开详情（抽屉或浮层）。
   - 知识卡 `source_chunks`、复核 `pid` 能关联回正文/章节（能定位即可，视口感知计数可选不强求）。
   - 课程摘要区的标签（主题标签 vs 作品标签）样式区分：作品标签点击走旁征博引浮层（同 1）。

## 不做 / 边界
- 不碰 apps/api、textcore、schemas、prompts、docs/prototype（只读）。
- 不引入硬编码业务数据；全部来自真实 API 的 classics_refs/knowledge_cards/writing_materials/review_flags。某课该字段为空时显示空态，不造假。
- 不提交 git。

## 验收标准
- 点作品篇名/作者 → 旁征博引浮层显示原文/译文/注释/赏析/来源（用 classics_refs 真实数据）；醉叟传demo版/实验02 有古文的能弹出。
- 复核标记灰色低干扰 + hover 气泡；右侧复核项可定位。
- 知识卡/素材点击可看详情。
- 某课无 classics_refs/卡片/素材时显示空态，不报错不造假。
- `cd apps/web && npm run check` + `npm run build` 通过。

## 完成后
- `OUTBOX_CODEX.md`：旁征博引浮层/复核交互/资源联动各怎么实现、用了哪些字段、空态处理、与 demo 差异、check/build 结果。
- `LOG.md` 追加：`[时间] CODEX: A2.3 资源联动+旁征博引 完成`。
