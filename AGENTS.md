# Agent instructions for Helix

Follow `ARCHITECTURE.md`:

- **Agents are not Python-only.** Prefer TypeScript agents in `src/agent/` for the IDE chat loop (AI SDK).
- Python FastAPI agents in `backend/` are an optional second runtime — keep them working, don’t delete them.
- UI, Monaco, and desktop chrome stay TypeScript.
- Modular tool-use agents with clear error boundaries.
- Unlimited token/step budget by default (`HELIX_MAX_TOKENS=0`, `HELIX_MAX_STEPS=0`).
