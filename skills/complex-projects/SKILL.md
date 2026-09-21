---
name: Complex projects
description: How Helix Own scaffolds and delivers multi-file, multi-layer products.
---

# Complex project delivery

## Decomposition

Break work into milestones and complete them in order:

1. **Scaffold** — `scaffold_project` (or create folders/files) with runnable skeleton.
2. **Contracts** — types/schemas for API payloads; shared interfaces.
3. **Core domain** — pure logic / services with clear boundaries.
4. **Adapters** — HTTP, UI, DB, agent tools.
5. **Verify** — `quality_check`, manual smoke paths.
6. **Polish** — README run steps, env example, ship artifacts if requested.

## Architecture choices (default)

| Need | Default |
| --- | --- |
| Web app / SaaS | React + Vite (+ Express/FastAPI) |
| Marketing website | Vite static (`website`) |
| Desktop app | Electron + same UI |
| Browser game | TypeScript canvas loop (`game-canvas`) |
| Minecraft mod | Fabric (`mod-fabric`) — verify versions from docs |
| Browser extension | Manifest V3 (`browser-extension`) |
| Agents | Tool-use loop with streaming events |

## Product types Helix optimizes for

Apps · websites · games · mods · CLIs · APIs · libraries — always aim for a **runnable slice** before polish.

## Anti-patterns

- Giant single files
- Untyped `any` everywhere
- Claiming “done” without running the app/typecheck
- Scaffold spam without wiring imports/scripts
