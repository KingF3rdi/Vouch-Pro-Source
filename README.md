# Helix

Desktop coding IDE with autonomous AI agents.

## Architecture

**Agents are not Python-only.**

| Layer | Stack |
| --- | --- |
| **TypeScript agents (primary)** | Node / Express, Vercel AI SDK — `src/agent/` |
| **Python agents (optional)** | FastAPI / LangChain — `backend/` on port 8788 |
| **Front-end & desktop** | React, Monaco, Electron |

See `ARCHITECTURE.md` and `AGENTS.md`.

## Quick start

```bash
export HELIX_WORKSPACE=$PWD
npm run dev          # TS agent API :8787 + UI
# optional:
npm run dev:all      # also start Python agents on :8788
```

- UI: http://127.0.0.1:5173  
- TS agents: http://127.0.0.1:8787/api/health (`backend: typescript-agent`)
- Python agents (optional): http://127.0.0.1:8788/api/health

Desktop:

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

## Unlimited tokens

- `HELIX_MAX_TOKENS=0` / `HELIX_MAX_STEPS=0` — no soft caps (hard step safety cap still applies)
