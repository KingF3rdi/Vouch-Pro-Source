---
name: Code quality
description: Quality gates and coding standards Helix Own must enforce.
---

# Code quality

## After every meaningful change

1. Call `quality_check` (or `npm run typecheck` / project equivalent).
2. If it fails: read the error, fix with tools, re-run.
3. Only then summarize success.

## Standards

- Strict TypeScript / typed Python (Pydantic) at boundaries.
- Small functions; one responsibility per module.
- Names that match domain language.
- Errors: actionable messages; no silent catches.
- Tests when the project already has a test runner — extend it, don’t invent a second one.

## Diff hygiene

- Touch only what the task needs.
- No unrelated formatting storms.
- Delete dead code you introduced; don’t leave TODOs that block running.
