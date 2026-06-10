# Claude Code Context

TextCore is a local-first app for turning course Word transcripts into readable study notes, knowledge cards, writing material, and exportable documents.

## Current Phase

- Phase 0: engineering scaffold and AI collaboration console.
- Current Codex task: `handoff/INBOX_CODEX.md`.
- Status board: `ai/CURRENT_STATUS.md`.

## Key Documents

- `00_产品设计/开发计划/TextCore_正式开发框架与AI协作计划_v0.1.md`
- `ai/decisions/ADR-001-tech-stack.md`
- `ai/decisions/ADR-004-version-tiers.md`
- `AGENTS.md`

## Review Checklist

- Confirm Codex did not modify protected design/material paths.
- Run `make install` if dependencies are not present.
- Run `make check`.
- Verify `/health` returns `{"status":"ok"}` when `make dev` is running.
- Review `handoff/OUTBOX_CODEX.md` and `handoff/LOG.md`.
