# Helix

Desktop coding IDE with autonomous AI agents.

## Architecture (strict)

| Layer | Stack |
| --- | --- |
| **Back-end & agents** | Python — FastAPI, Pydantic, LangChain-ready tools |
| **Front-end & desktop** | TypeScript — React, Monaco, Electron/Tauri |

See `ARCHITECTURE.md` and `AGENTS.md`.

## Quick start

```bash
# Python agents API
npm run backend:install
# or: pip install -r backend/requirements.txt

# UI + Python API
export HELIX_WORKSPACE=$PWD
npm run dev
```

- UI: http://127.0.0.1:5173  
- API: http://127.0.0.1:8787/api/health (`backend: python-fastapi`)

Desktop (same UI):

```bash
npm run desktop
```

## Helix models

| Model | Engine |
| --- | --- |
| Helix Code | GPT‑6 Astra class |
| Helix Astra | `openai/gpt-6-astra` |
| Helix Fable | `anthropic/claude-fable-5.1` |
| Helix Local | Ollama `qwen2.5-coder` |

Set `AI_GATEWAY_API_KEY` (or OpenAI/Anthropic keys) in `.env`.

## Unlimited tokens & frontier agent quality

Helix is tuned to match Cursor / Claude-style coding agents:

- **Full tool-use loop** in Python (LangChain function calling): map → search → edit → build → ship
- **`HELIX_MAX_TOKENS=0`** — no soft output cap (provider maximum)
- **`HELIX_MAX_STEPS=0`** — keep tool-calling until the task is done (hard safety cap `HELIX_HARD_STEP_CAP`, default 1000)
- **`HELIX_TOOL_READ_MAX_CHARS=0`** — tools read full files

Quality equals the underlying engine: Helix Code/Astra/Fable need gateway or provider keys; Helix Local needs Ollama.

```
backend/               # FastAPI + Python agents / tools
src/ui/                # React IDE (TypeScript)
src/shared/            # TS interfaces mirroring Pydantic schemas
ARCHITECTURE.md        # stack rules
```
