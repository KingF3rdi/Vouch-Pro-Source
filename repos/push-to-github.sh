#!/usr/bin/env bash
# Auf deinem PC ausführen (mit GitHub Login) — Agent-Token hat kein Push-Recht auf neue Repos
set -euo pipefail

OWNER="${GITHUB_OWNER:-KingF3rdi}"

declare -A MAP=(
  [txtempire-shop-website]=txtempire-website
  [txtempire-discord-bot]=txtempire-shop-bot
)

ROOT="$(cd "$(dirname "$0")" && pwd)"

for local in txtempire-shop-website txtempire-discord-bot; do
  remote="${MAP[$local]}"
  echo "=== Push $local → $OWNER/$remote ==="
  cd "$ROOT/$local"
  git remote remove origin 2>/dev/null || true
  git remote add origin "https://github.com/${OWNER}/${remote}.git"
  git push -u origin main
  echo "https://github.com/${OWNER}/${remote}"
done

echo ""
echo "Minecraft-Bot: Ordner $ROOT/txtempire-minecraft-bot"
echo "→ Lege Repo txtempire-minecraft-bot an ODER kopiere nach txtempire-shop-bot/minecraft-bot"
echo "  cd $ROOT/txtempire-minecraft-bot && git remote add origin ... && git push -u origin main"
