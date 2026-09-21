---
name: Debugging
description: Reproduce, isolate, patch, and verify defects systematically.
---

# Debugging

1. Reproduce with the smallest failing command or UI path.
2. Isolate with `search_files` / `read_file` / stack traces.
3. Form one hypothesis; patch with `apply_patch` or `write_file`.
4. Verify with `run_tests` / `quality_check`.
5. Report root cause → fix → proof.
