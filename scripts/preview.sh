#!/usr/bin/env bash
# TxTEmpire Shop — Vorschau starten (Backend + Frontend)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

export BOT_API_KEY="${BOT_API_KEY:-preview-bot-api-key}"
export SHOP_API_URL="${SHOP_API_URL:-http://localhost:8000}"

echo "=== TxTEmpire Shop Vorschau ==="
echo "API-Key (überall gleich): $BOT_API_KEY"
echo ""

# Backend
if ! curl -sf http://localhost:8000/api/health >/dev/null 2>&1; then
  echo "Starte Backend :8000 …"
  cd "$ROOT/backend"
  python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
  sleep 2
fi

# Frontend
if ! curl -sf http://localhost:3000 >/dev/null 2>&1; then
  echo "Starte Frontend :3000 …"
  cd "$ROOT/frontend"
  npm run dev -- -H 0.0.0.0 -p 3000 &
  sleep 5
fi

echo ""
echo "Website:  http://localhost:3000"
echo "API:      http://localhost:8000"
echo "Health:   http://localhost:8000/api/health"
echo ""
echo "Bots (optional, eigene Terminals):"
echo "  cd minecraft-bot && npm start"
echo "  cd discord-bot && python3 bot.py"
echo ""
echo "Gleiche Keys in backend/.env, minecraft-bot/.env, discord-bot/.env"
