# Helix architecture rules

Strict front-end / back-end separation for this coding IDE with autonomous AI agents.

## Tech stack

| Layer | Languages & frameworks |
| --- | --- |
| **Back-end & agents** | Python — FastAPI, LangChain/CrewAI, Pydantic |
| **Front-end & desktop UI** | TypeScript — React, Next.js (or Vite React), Monaco Editor, Tauri |

## Rules (always)

1. **Architecture strictness**
   - AI logic, LLM orchestration, data processing, and agent tools → **Python only**
   - UI, editor components, and client infrastructure → **TypeScript only**

2. **Communication**
   - Structured JSON over **REST (FastAPI)** and/or **WebSockets** for realtime between TS client and Python agents

3. **Type safety**
   - Clean **Pydantic** models in Python
   - Matching **TypeScript interfaces** for the same payloads

4. **Agent design**
   - Modular Python agents with **tool use / function calling**
   - Clear responsibilities and error boundaries per agent

5. **Performance**
   - Keep the TypeScript front-end non-blocking
   - Offload compute-heavy work asynchronously to the Python back-end

## Layout

```
backend/                 # FastAPI + agents (Python only)
  app/agents/            # CodingAgent + tools (function calling)
  app/models/schemas.py  # Pydantic contracts
  app/api/routes.py      # REST + WebSocket /api/ws/agent
src/ui/                  # React IDE (TypeScript only)
src/shared/api-contracts.ts  # Mirrored TS interfaces
electron/                # Desktop shell (spawns Python uvicorn)
```

## Agent stream protocol

Python emits `AgentEvent` (`status` | `token` | `tool_start` | `tool_result` | `error` | `done`) via:

- `POST /api/chat` → NDJSON
- `WS /api/ws/agent` → JSON frames (preferred)

TypeScript must not call LLMs directly; it only renders events.
