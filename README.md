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
| **Helix Free** (default without paid keys) | Local Ollama `qwen2.5-coder` + agent curriculum |
| Helix Code | GPT‑6 Astra class (needs key) |
| Helix Astra | `openai/gpt-6-astra` |
| Helix Fable | `anthropic/claude-fable-5.1` |
| Helix Groq / OpenRouter | Free-tier cloud (optional keys) |
| Helix Local | Ollama offline |

```bash
npm run setup:free   # install/pull free local coder
```

See `docs/FREE_MODELS.md`. We do **not** scrape or invent paid API keys — Helix Free is the zero-cost path.
