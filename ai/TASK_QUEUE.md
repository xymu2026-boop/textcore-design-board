# TextCore Task Queue

> Status source for AI collaboration. Keep this file concise; detailed execution notes belong in `handoff/`.

| ID | Priority | Owner | Status | Inputs | Expected Output | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| T001 | P0 | Codex | In review | Phase 0 plan, ADR-001, ADR-004 | Monorepo scaffold, Makefile, collaboration docs | `make install`, `make dev`, `make check` |
| T002 | P0 | Claude | Pending | Product definition, pipeline plan, ADR-004 | Frozen `course_state` and stage/API schemas | Schema tests pass |
| T003 | P0 | Claude | Pending | T002 schemas | Pipeline runner/state skeleton | Runner/state unit tests pass |
| T004 | P1 | Codex | Pending | Frozen API schemas | FastAPI upload/course placeholders wired to storage | API tests pass |
| T005 | P1 | Codex | Pending | Existing prototype, frozen API schemas | React/Vite app shell and route structure | Frontend checks pass |

## Notes

- Codex implementation results go to `handoff/OUTBOX_CODEX.md`.
- Claude review outcomes and next dispatches go through `handoff/INBOX_CODEX.md`.
- Final commits are made only after Claude review and green checks.
