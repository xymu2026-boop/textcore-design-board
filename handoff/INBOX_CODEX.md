# INBOX · Codex · P4 S9 区分 preferred/hard 区间（warning vs risk）

> 流水线融合 Phase 4（小改）。分支 `pipeline-fusion`。**改 `textcore/pipeline/stages/s9_quality.py` + 测试**。
> 不动 schema、前端、API、其它 stage。**不提交 git**。结果写 `handoff/OUTBOX_CODEX.md`，`LOG.md` 追加一行。
> 可用：`deterministic.quality_gates.check_version_ratio(...)`。

## 目标
当前 S9 用单一 compression range 判断越界。改为区分 **preferred（理想）/ hard（硬底线）** 两档，并在 `quality.main_risks` 里区分 `warning`（偏离 preferred 但在 hard 内）和 `risk`（超出 hard）。让质检更贴近用户认可标准，但不要因为偏离 preferred 就判失败。

## 改造 `s9_quality.py`
- 四档区间（对原文占比）：
  - faithful：preferred 0.85-0.93，hard 0.70-0.95
  - concise：preferred 0.28-0.38，hard 0.22-0.45
  - study：preferred 0.08-0.12，hard 0.05-0.15
  - outline：preferred 0.04-0.07，hard 0.03-0.10
- 对每档用真实 char_count/原文字数算 ratio：
  - 在 preferred 内：不报。
  - 在 hard 内但偏离 preferred：`main_risks` 加一条 `warning`，文案如"精简整理版占比 20%，低于理想区间(28-38%)但在可接受范围"。
  - 超出 hard：`main_risks` 加一条 `risk`，并将 `recommended_human_review=True`。
- 可复用 `check_version_ratio`（它已返回 level: ok/warning/risk）。
- `quality_score`/`coverage` 维持现有计算逻辑或据 risk 数量略调（不强制）。
- 古文保护/复核聚合等 S9 现有逻辑保持不变。

## 边界
- 不改 schema（`$defs/quality` 的 main_risks 仍是字符串数组，warning/risk 用文案前缀区分即可，如"[warning] ..."/"[risk] ..."）。
- 不动其它 stage、前端、API。不提交 git。

## 测试（不联网）
- 构造四档 char_count：全在 preferred → 无 risk。
- 某档在 hard 内偏离 preferred → main_risks 出现 warning 文案、不强制 human_review。
- 某档超出 hard（如 faithful 0.5）→ main_risks 出现 risk 文案、recommended_human_review=True。

## 验收
- `make check` 全绿。S9 能区分 warning/risk。

## 完成后
- `OUTBOX_CODEX.md`：S9 改造点、warning/risk 文案口径、测试、make check 结果。
- `LOG.md` 追加：`[时间] CODEX: P4 S9 preferred/hard区间 完成`。
