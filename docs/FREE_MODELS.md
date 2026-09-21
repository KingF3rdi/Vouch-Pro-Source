# Helix Free models

Helix cannot steal paid API keys and cannot retrain a GPT‑class model from scratch.
Instead it ships **Helix Free**: a real coding agent on **free weights + agent curriculum**.

## What we did

1. **Local Ollama** (already set up here) with `qwen2.5-coder:3b` (tool-calling capable).
2. **Helix Free** model profile — auto-selects Ollama, or Groq/OpenRouter if you add free-tier keys.
3. **`skills/agent-curriculum`** — distilled workflow (map → search → edit → verify → ship), the practical equivalent of “training” for open models.

## Setup on any machine

```bash
npm run setup:free
npm run dev
```

Pick **Helix Free** in the model picker (default when no paid keys).

## Optional free cloud keys (you sign up — we never scrape keys)

| Provider | Env var | Where |
| --- | --- | --- |
| Groq | `GROQ_API_KEY` | https://console.groq.com/keys |
| OpenRouter | `OPENROUTER_API_KEY` | https://openrouter.ai/keys |
| Google AI Studio | `GOOGLE_GENERATIVE_AI_API_KEY` | https://aistudio.google.com/apikey |

Paid Helix Code / Astra / Fable still need `AI_GATEWAY_API_KEY` (or OpenAI/Anthropic).

## Quality note

Frontier paid models still win on hard reasoning. Helix Free closes the gap with **more tools, stricter curriculum, and unlimited steps** — same agent *behavior*, open weights.
