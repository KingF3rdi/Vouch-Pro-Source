# TxTEmpire — drei separate Repositories

Vorbereitet unter `/workspace/repos/` (jeweils eigenes Git-Repo, Branch `main`).

| Repo-Ordner | Inhalt | GitHub-Name (Vorschlag) |
|-------------|--------|-------------------------|
| `txtempire-shop-website` | `backend/` + `frontend/` | `KingF3rdi/txtempire-shop-website` |
| `txtempire-minecraft-bot` | Mineflayer Bot | `KingF3rdi/txtempire-minecraft-bot` |
| `txtempire-discord-bot` | Discord Shop Bot | `KingF3rdi/txtempire-discord-bot` |

## GitHub Repos anlegen (manuell)

Der Cloud-Agent-Token darf **keine neuen Repos erstellen**. Bitte einmal auf GitHub:

1. https://github.com/new
2. Repository name: `txtempire-shop-website` (public/private nach Wahl)
3. **Kein** README, .gitignore oder License hinzufügen (leeres Repo)
4. Wiederholen für `txtempire-minecraft-bot` und `txtempire-discord-bot`

## Pushen

```bash
cd /workspace/repos
chmod +x push-to-github.sh
./push-to-github.sh
```

Oder einzeln:

```bash
cd /workspace/repos/txtempire-shop-website
git remote add origin https://github.com/KingF3rdi/txtempire-shop-website.git
git push -u origin main
```

## Archives (Download)

- `/opt/cursor/artifacts/exports/txtempire-shop-website.tar.gz`
- `/opt/cursor/artifacts/exports/txtempire-minecraft-bot.tar.gz`
- `/opt/cursor/artifacts/exports/txtempire-discord-bot.tar.gz`

## Verbindung

```
txtempire-shop-website (API)
        ▲
        ├── txtempire-minecraft-bot  (BOT_API_KEY)
        └── txtempire-discord-bot    (BOT_API_KEY)
```

Client-Mod bleibt optional im Monorepo `Vouch-Pro-Source` unter `minecraft-client-mod/`.
