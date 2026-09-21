#!/usr/bin/env bash
# One-command Helix: train weights if missing, ensure models, start IDE.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.local/bin:${PATH}"
export HELIX_WORKSPACE="${HELIX_WORKSPACE:-$ROOT}"

echo "══ Helix Own — simple start ══"

# 1) Python train deps (lightweight)
if [[ ! -f training/output/helix-own-lora/helix_own_ft.json ]]; then
  echo "[start] Weight training Helix Own (LoRA)…"
  python3 -m pip install -q --user \
    "torch" "transformers>=4.44" "peft>=0.12" "datasets>=2.20" "accelerate>=0.33" "trl>=0.9" \
    2>/dev/null || python3 -m pip install -q \
    "torch" "transformers>=4.44" "peft>=0.12" "datasets>=2.20" "accelerate>=0.33"
  python3 training/train_lora.py --steps "${HELIX_FT_STEPS:-40}"
else
  echo "[start] LoRA weights present — skip train (HELIX_FT_FORCE=1 to retrain)"
  if [[ "${HELIX_FT_FORCE:-0}" == "1" ]]; then
    python3 training/train_lora.py --steps "${HELIX_FT_STEPS:-40}"
  fi
fi

# 2) Ollama behavioral model (optional companion)
if command -v ollama >/dev/null 2>&1; then
  if ! curl -sf http://127.0.0.1:11434/api/tags >/dev/null; then
    nohup ollama serve >/tmp/helix-ollama.log 2>&1 &
    sleep 2
  fi
  bash scripts/setup-free-models.sh || true
fi

# 3) Serve fine-tuned weights (OpenAI-compatible)
if [[ -f training/output/helix-own-lora/helix_own_ft.json ]]; then
  if ! curl -sf http://127.0.0.1:11435/health >/dev/null; then
    echo "[start] Starting Helix Own FT server on :11435"
    nohup python3 training/serve_ft.py >/tmp/helix-ft-serve.log 2>&1 &
    sleep 3
  fi
fi

mkdir -p .helix
printf '%s\n' '{"modelId":"helix-free"}' > .helix/settings.json
grep -q '^HELIX_MODEL=' .env 2>/dev/null && sed -i 's/^HELIX_MODEL=.*/HELIX_MODEL=helix-free/' .env || true

echo "[start] Launching IDE (TS agent + UI)…"
exec npm run dev
