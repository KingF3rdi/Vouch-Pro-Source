#!/usr/bin/env bash
# Auf dem Bot-Server (/home/container) — holt neuesten Code ohne txtempire-shop-bot Push.
set -euo pipefail

VOUCH_REPO="${VOUCH_REPO:-https://github.com/KingF3rdi/Vouch-Pro-Source.git}"
BRANCH="${BRANCH:-export-txtempire-discord-bot}"

git remote remove vouch 2>/dev/null || true
git remote add vouch "$VOUCH_REPO"
git fetch vouch "$BRANCH"
git reset --hard "vouch/$BRANCH"
echo "Deploy OK: $(git log -1 --oneline)"
