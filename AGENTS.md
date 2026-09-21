# Agent instructions for Helix

When generating or changing code in this repo, follow `ARCHITECTURE.md` strictly:

- Python for agents, LLM orchestration, tools, and data APIs (FastAPI + Pydantic).
- TypeScript for UI, Monaco, client state, and Tauri desktop shell.
- Never put agent/tool/LLM orchestration in TypeScript.
- Never put React/Monaco/desktop chrome in Python.
- Keep API contracts mirrored: Pydantic ↔ TypeScript interfaces.
- Prefer WebSocket streams for agent tokens/tool events; REST for CRUD.
