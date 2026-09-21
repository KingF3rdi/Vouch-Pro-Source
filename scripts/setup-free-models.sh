#!/usr/bin/env bash
# Train / create Helix Own local model + pull base coder (no paid API keys).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"

echo "[helix-own] Ensuring Ollama is available…"

if ! command -v ollama >/dev/null 2>&1; then
  echo "[helix-own] Ollama not on PATH. Install from https://ollama.com"
  exit 1
fi

if ! curl -sf http://127.0.0.1:11434/api/tags >/dev/null; then
  echo "[helix-own] Starting ollama serve…"
  nohup ollama serve >/tmp/helix-ollama.log 2>&1 &
  sleep 2
fi

BASE="${HELIX_OWN_BASE:-qwen2.5-coder:3b}"
echo "[helix-own] Pulling base model ${BASE}…"
ollama pull "$BASE"

echo "[helix-own] Creating trained Helix Own model from Modelfile…"
ollama create helix-own -f "${ROOT}/ollama/HelixOwn.Modelfile"

mkdir -p "${HELIX_WORKSPACE:-$ROOT}/.helix"
printf '%s\n' '{"modelId":"helix-free"}' > "${HELIX_WORKSPACE:-$ROOT}/.helix/settings.json"

# Prefer helix-own in env hint file
if [ -f "${ROOT}/.env" ]; then
  grep -q '^HELIX_LOCAL_MODEL=' "${ROOT}/.env" \
    && sed -i 's/^HELIX_LOCAL_MODEL=.*/HELIX_LOCAL_MODEL=helix-own/' "${ROOT}/.env" \
    || echo 'HELIX_LOCAL_MODEL=helix-own' >> "${ROOT}/.env"
  grep -q '^HELIX_MODEL=' "${ROOT}/.env" \
    && sed -i 's/^HELIX_MODEL=.*/HELIX_MODEL=helix-free/' "${ROOT}/.env" \
    || echo 'HELIX_MODEL=helix-free' >> "${ROOT}/.env"
fi

echo "[helix-own] Ready. Model: helix-own (curriculum baked in)."
echo "[helix-own] Skills training pack: agent-curriculum, complex-projects, code-quality"
echo "[helix-own] Run: npm run dev  → pick Helix Own in the model picker"
