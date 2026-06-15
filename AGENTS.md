# TextCore Agent Rules

## Project

TextCore is a local-first study material processor. The first product turns course Word transcripts into classroom notes, knowledge cards, writing material, and exportable documents.

## Collaboration Protocol

- All task handoff goes through files.
- Claude Code writes instructions in `handoff/INBOX_CODEX.md`.
- Codex CLI implements the scoped task, writes results to `handoff/OUTBOX_CODEX.md`, and appends one line to `handoff/LOG.md`.
- Claude Code reviews every Codex diff, runs acceptance checks, and performs the final git commit.
- Do not rely on chat memory for project state. Use `ai/CURRENT_STATUS.md`, `ai/TASK_QUEUE.md`, `handoff/`, git, and test output.

## Roles

- Claude Code: architecture, schemas/contracts, pipeline runner/state machine, LLM adapter reliability, classics matching, regression framework, task dispatch, and final review.
- Codex CLI: scaffold, repository/storage implementation after contracts freeze, FastAPI routes, React/Vite migration, S0-S3 deterministic stages, exporter implementation, focused unit tests, and implementation handoff.

## Discipline

- Keep every task small and independently checkable.
- Run `make check` before handing work back unless the task explicitly says otherwise.
- Do not submit real API keys. Secrets belong in `.env.local`, which must stay ignored.
- Phase 1 schemas are integration boundaries. After they freeze, schema changes require an ADR or explicit task.
- Business logic, schemas, prompts, and UI migration should not be mixed in one task unless the inbox explicitly asks for it.

## Protected Areas

Do not modify these paths unless the task explicitly authorizes it:

- `docs/`
- `00_产品设计/`
- `素材/`
- `tools/`
- `ai/decisions/`

Existing design-board content in `README.md` must be preserved; append development notes instead of replacing it.

## Local Commands

- `make install`: create Python venv, install API dependencies, install web dependencies.
- `make dev`: run FastAPI on `127.0.0.1:8000` and Vite on `127.0.0.1:5173`.
- `make check`: run frontend typecheck/lint and backend ruff/pytest.
