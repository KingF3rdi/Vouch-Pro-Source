#!/usr/bin/env bash
# Set up Helix Free: local Ollama coding model (no paid API keys required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"

echo "[helix-free] Ensuring Ollama is available…"

if ! command -v ollama >/dev/null 2>&1; then
  echo "[helix-free] Ollama not on PATH. Install from https://ollama.com or place binary in ~/.local/bin"
  exit 1
fi

if ! curl -sf http://127.0.0.1:11434/api/tags >/dev/null; then
  echo "[helix-free] Starting ollama serve…"
  nohup ollama serve >/tmp/helix-ollama.log 2>&1 &
  sleep 2
fi

MODEL="${HELIX_LOCAL_MODEL:-qwen2.5-coder:3b}"
echo "[helix-free] Pulling ${MODEL} (free, local)…"
ollama pull "$MODEL"

# Prefer Helix Free in workspace settings
mkdir -p "${HELIX_WORKSPACE:-$ROOT}/.helix"
printf '%s\n' '{"modelId":"helix-free"}' > "${HELIX_WORKSPACE:-$ROOT}/.helix/settings.json"

echo "[helix-free] Ready. Run: npm run dev"
echo "[helix-free] Optional free cloud tiers (signup yourself — we never steal keys):"
echo "  GROQ_API_KEY       https://console.groq.com/keys"
echo "  OPENROUTER_API_KEY https://openrouter.ai/keys  (free models available)"
echo "  GOOGLE_GENERATIVE_AI_API_KEY  https://aistudio.google.com/apikey"
