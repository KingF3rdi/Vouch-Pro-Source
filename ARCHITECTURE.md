# Helix architecture rules

Hybrid agent architecture for this coding IDE — **agents are not Python-only**.

## Tech stack

| Layer | Languages & frameworks |
| --- | --- |
| **TypeScript agents** (primary) | Node / Express, Vercel AI SDK, tool-calling in `src/agent/` |
| **Python agents** (optional) | FastAPI, LangChain, Pydantic in `backend/` |
| **Front-end & desktop UI** | TypeScript — React, Monaco, Electron/Tauri |

## Rules

1. **Agents may be TypeScript and/or Python**
   - Default chat/agent runtime: **TypeScript** (`src/agent` + `src/server`)
   - Optional second runtime: **Python** FastAPI agents (`backend/`, port `HELIX_PYTHON_PORT`, default 8788)
   - UI stays TypeScript; never put React/Monaco in Python

2. **Communication**
   - Structured JSON over REST (and WebSockets where useful)
   - Same IDE API shapes where both backends expose them

3. **Type safety**
   - Shared TypeScript types in `src/shared/`
   - Pydantic models in Python when the Python runtime is used

4. **Agent design**
   - Modular tool-use agents with clear responsibilities and error boundaries
   - Language of implementation is not a quality gate — use TS or Python as needed

5. **Performance**
   - Keep the React UI non-blocking; stream agent work asynchronously

## Layout

```
src/agent/               # TypeScript coding agents + tools (primary)
src/server/              # Express API + AI SDK chat stream
src/ui/                  # React IDE
backend/                 # Optional Python FastAPI agents
electron/                # Desktop shell (spawns TS server by default)
```

## Unlimited tokens

Defaults (`HELIX_MAX_TOKENS=0`, `HELIX_MAX_STEPS=0`) remove soft caps so agents behave like Cursor/Claude Code.
