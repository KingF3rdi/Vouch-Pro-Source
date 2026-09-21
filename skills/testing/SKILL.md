---
name: Testing
description: Add and run tests; never claim done without verification when a runner exists.
---

# Testing

- Prefer the project's existing test runner (`npm test`, `pytest`, etc.).
- Add focused tests next to the change when feasible.
- Use `run_tests` tool. If red, fix then re-run.
- Do not delete failing tests to "pass".
