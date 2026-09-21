---
name: Games and mods
description: Patterns for browser games, game loops, and host-platform mods/extensions.
---

# Games & mods

## Browser games

- Use a fixed timestep or `requestAnimationFrame` with delta clamping.
- Structure: `main` → `Game` → `Scene` → entities/components.
- Input via keyboard/pointer maps; never read DOM every entity every frame blindly.
- Separate render from simulation when complexity grows.
- Keep assets small; placeholder rectangles/circles are fine for first playable.

## Minecraft / game mods

- Target one loader (Fabric **or** Forge/NeoForge) — do not mix.
- Match Minecraft version ↔ mappings ↔ dependency versions from official docs.
- Entry: mod initializer + optional client initializer.
- First feature should be tiny and testable in-game.
- Document: JDK version, `./gradlew build`, where the `.jar` lands, how to install.

## Browser extensions

- Manifest V3 by default.
- Privileges: request the minimum host permissions.
- Content scripts for page DOM; service worker for background events.
- Ship `manifest.json` + icons + clear load-unpacked steps.
