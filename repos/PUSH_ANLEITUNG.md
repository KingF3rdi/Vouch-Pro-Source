# Repos befüllen — 3 Optionen

Der Code liegt fertig auf Branch **`export-txtempire-*`** in `Vouch-Pro-Source`.

| Ziel-Repo | Export-Branch |
|-----------|---------------|
| `KingF3rdi/txtempire-website` | `export-txtempire-website` |
| `KingF3rdi/txtempire-shop-bot` | `export-txtempire-discord-bot` |
| `KingF3rdi/txtempire-minecraft-bot` | `export-txtempire-minecraft-bot` |

---

## Option 1 — GitHub Action (empfohlen, 2 Minuten)

1. GitHub → **KingF3rdi/Vouch-Pro-Source** → Settings → Secrets → Actions  
2. New secret: `REPO_PUBLISH_PAT` = [Personal Access Token](https://github.com/settings/tokens) mit Scope **`repo`**
3. Actions → **Publish split repos** → **Run workflow**

Fertig — alle Repos werden befüllt.

---

## Option 2 — Lokal (3 Befehle)

```bash
# Website
git clone -b export-txtempire-website https://github.com/KingF3rdi/Vouch-Pro-Source.git w && \
cd w && git remote add t https://github.com/KingF3rdi/txtempire-website.git && \
git push t HEAD:main

# Discord → shop-bot
git clone -b export-txtempire-discord-bot https://github.com/KingF3rdi/Vouch-Pro-Source.git d && \
cd d && git remote add t https://github.com/KingF3rdi/txtempire-shop-bot.git && \
git push t HEAD:main

# Minecraft (Repo muss existieren)
git clone -b export-txtempire-minecraft-bot https://github.com/KingF3rdi/Vouch-Pro-Source.git m && \
cd m && git remote add t https://github.com/KingF3rdi/txtempire-minecraft-bot.git && \
git push t HEAD:main
```

---

## Option 3 — Cursor-Bot einladen

Repo Settings → Collaborators → **`cursor[bot]`** mit **Write** hinzufügen  
(für `txtempire-website` und `txtempire-shop-bot`)

Dann kann der Cloud-Agent direkt pushen.

---

## Warum der Agent nicht pushen konnte

`cursor[bot]` hat nur Zugriff auf `Vouch-Pro-Source`, nicht auf deine neuen leeren Repos (`permissions.push: false`).
