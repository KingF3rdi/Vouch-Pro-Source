#!/usr/bin/env bash
# Pusht export-txtempire-discord-bot → KingF3rdi/txtempire-shop-bot (main)
# Auf deinem PC ausführen — benötigt GitHub PAT mit repo-Rechten auf txtempire-shop-bot.
set -euo pipefail

if [ -z "${GITHUB_PAT:-}" ]; then
  echo "GITHUB_PAT fehlt. Beispiel:"
  echo "  GITHUB_PAT=ghp_xxx ./scripts/push-shop-bot.sh"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

git fetch origin export-txtempire-discord-bot
git push "https://x-access-token:${GITHUB_PAT}@github.com/KingF3rdi/txtempire-shop-bot.git" \
  export-txtempire-discord-bot:main --force

echo "OK: https://github.com/KingF3rdi/txtempire-shop-bot"
