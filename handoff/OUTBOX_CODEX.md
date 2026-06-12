# OUTBOX · Codex · P1 确定性 scaffold 模块

## 改动范围

- 新增 `textcore/pipeline/deterministic/`：
  - `__init__.py`
  - `transcript_cleaner.py`
  - `sentence_ranker.py`
  - `version_scaffold.py`
  - `quality_gates.py`
- 新增 `tests/unit/test_deterministic_scaffold.py`。
- 未接入 S4/S7/runner；未改 schema、前端、API、现有 S0-S10 stage 文件。
- 未提交 git。

## 模块接口

- `clean_transcript_text(text, *, preserve_spans=()) -> {"text", "review_flags", "applied_repairs"}`
  - mask `preserve_spans` 后再做清理，最后原样还原。
  - 去时间戳/说话人前缀、口头禅、短课堂管理语、重复标点。
  - 不做篇目专属错字替换；疑似术语/ASR 噪声只进 `review_flags`。
- `sentence_split(text) -> list[str]`
- `score_sentence(sentence, position, *, keyword_sets=DEFAULT_KEYWORD_SETS) -> int`
- `important_sentences(text_or_paragraphs, limit, *, keyword_sets=DEFAULT_KEYWORD_SETS) -> list[str]`
  - 另提供内部复用的 `rank_sentences` / `select_sentences_to_target`。
- `build_chunk_scaffolds(*, chunk_id, title, original_text, cleaned_text=None, course_types=None, preserve_spans=()) -> dict`
  - 返回 `faithful/concise/study/outline` 四档，每档含 `body_md/char_count/compression`。
  - chunk 标题由当前块高分句截取，后续可由 S6/LLM 改写。
- `check_version_ratio(*, version_key, actual_chars, source_chars, preferred=None, hard=None) -> dict`
  - preferred 内 `accept`，hard 内 `warning/retry`，hard 外 `risk/fallback`。

## 关键词类别表

- `discourse_markers`：第一/第二/第三/首先/其次/最后/所以/因此/总之/注意/重点/核心/关键/说明/意味着/总结。
- `method`：方法/步骤/技巧/规律/原则/思路。
- `reading_question`：题型/答题/概括/赏析/分析/作用/表达效果/中心/主旨/引用/比喻/修辞。
- `composition`：作文/立意/选材/结构/开头/结尾/语言/详略/描写/议论。
- `classical_poetry`：文言文/古诗/词/句读/翻译/字词/通假/活用/意象/典故。

## 四篇真实 Word 比例

| 文件 | 原文字数 | chunks | faithful | concise | study | outline |
|---|---:|---:|---:|---:|---:|---:|
| 五上-人文综合涵养-寒假-第二讲-虚实-晚秋初冬.docx | 28864 | 10 | 27382 / 94.87% | 9106 / 31.55% | 3008 / 10.42% | 1443 / 5.00% |
| 五上-人文综合涵养-寒假-第六讲-文言文阅读训练1.docx | 28213 | 11 | 25899 / 91.80% | 9063 / 32.12% | 3041 / 10.78% | 1190 / 4.22% |
| 五上-人文综合涵养-寒假-第三讲-隐显-偷钱+第四讲-文言文-醉叟传1.docx | 32003 | 12 | 29633 / 92.59% | 10056 / 31.42% | 3165 / 9.89% | 1303 / 4.07% |
| 五上-人文综合涵养-寒假-第七讲-阅读理解+作文点评2.docx | 31715 | 12 | 29866 / 94.17% | 10427 / 32.88% | 3489 / 11.00% | 1604 / 5.06% |

## 泛化做法与源工具差异

- 没有移植 `chunk_title()` 的篇目规则；标题来自通用打分句的前 N 字。
- 没有移植具体人名/篇名关键词；新词表只按语文课堂类别组织。
- 没有移植 `罪首→醉叟`、`古兽行销→骨瘦形销` 等硬纠错；疑似错字/噪声只标记候选。
- 输出 Markdown 版本对象，不渲染 HTML/JS，不写前端 demo 文件。
- 版本比例由代码按 chunk 抽句目标控制，整篇单测覆盖 4 篇真实 Word。
- `rg` 检查：`textcore/pipeline/deterministic/` 未出现 demo 人名/篇名/硬纠错词。

## 验证

- `.venv/bin/python -m pytest tests/unit/test_deterministic_scaffold.py -q`：6 passed。
- `make check`：通过。
  - 前端 typecheck/lint 通过。
  - `scripts/check_api.py` 通过。
  - 全量 pytest：30 passed，1 个既有 StarletteDeprecationWarning。

## 遗留

- `course_types` 参数已保留在 `build_chunk_scaffolds` 接口中，本步未按课型动态调权，后续 S4/S7 接入时可扩展。
- `review_flags` 当前只做低风险候选标记，尚未接入 S5 古文参考服务核对。
