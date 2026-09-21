---
name: Ship
description: Build, compile, and package the project into a final product (dist, binaries, installers).
---

# Ship skill

Your job is to turn source into a **final product** — not just edit files.

## Workflow

1. `detect_build_pipeline` — learn typecheck / build / compile / package commands.
2. Fix blockers (missing scripts, broken types) with normal coding tools if needed.
3. Prefer `ship_project` for the full pipeline, or `run_build_step` for one command.
4. `list_build_artifacts` — confirm outputs exist (e.g. `dist/`, `release/*.dmg|exe|AppImage`, binaries).
5. Report: commands run, success/failure, artifact paths + sizes, how the user installs/runs the product.

## Rules

- Always compile/package when the user asks to ship, release, build the app, or make installers.
- If a step fails, read the error, fix code or config, and re-run — do not stop at “build failed”.
- Prefer production/release flags (`--release`, `npm run build`, `npm run dist`) over dev servers.
- Do not commit secrets into packaged artifacts.
