# Ingame-Bot ↔ Website ↔ Discord — Anbindung

Der **Ingame-Bot** (`minecraft-bot/`) ist direkt mit der **Website-API** verbunden.  
Der **Discord-Bot** (`discord-bot/`) nutzt optional dieselbe API (Vouches, Katalog-Sync).

```
┌─────────────┐     Link-Code + Checkout      ┌──────────────┐
│   Website   │ ◄─────────────────────────── │   Spieler    │
│  Frontend   │                               └──────┬───────┘
└──────┬──────┘                                      │
       │ REST                                         │ /msg Bot link CODE
       ▼                                              │ /pay Bot <betrag>
┌─────────────┐     /api/bot/link/redeem              │
│   Backend   │ ◄─────────────────────────────────────┤
│  (FastAPI)  │     /api/bot/payments/confirm         │
└──────┬──────┘ ◄─────────────────────────────────────┘
       │ X-Bot-Api-Key                         ┌──────────────┐
       │                                       │ minecraft-bot│
       ├──────────────────────────────────────►│ (Mineflayer) │
       │                                       └──────────────┘
       │ /api/bot/vouches/sync
       │ /api/bot/catalog
       ▼
┌─────────────┐
│ discord-bot │  optional: Vouches + Kategorien von Website
└─────────────┘
```

## Welche Datei nutzen?

| Lösung | Ordner | Wann |
|--------|--------|------|
| **Bot-Account (empfohlen für Website-Shop)** | `minecraft-bot/` | Bot joint als Spieler, spricht mit Website-API |
| Paper-Plugin (Alternative) | `minecraft-plugin/` | Eigener Paper-Server, gleiche API, kein MC-Account |

Für den **Website-Shop mit ingame-Zahlung** → **`minecraft-bot/`**.

## Gleiche Keys überall

Diese Werte **müssen identisch** sein:

| Variable | backend/.env | minecraft-bot/.env | discord-bot/.env |
|----------|--------------|--------------------|------------------|
| API-Key | `BOT_API_KEY=...` | `BOT_API_KEY=...` | `BOT_API_KEY=...` |
| Shop-URL | — | `SHOP_API_URL=https://shop.dein.de` | `SHOP_API_URL=...` |
| Bot-IGN | `SHOP_BOT_IGN=DeinBot` | `MC_BOT_USERNAME=DeinBot` | — |
| Discord-Token | `DISCORD_BOT_TOKEN=...` | — | `DISCORD_TOKEN=...` |

## Ablauf ingame (Website-Shop)

1. Spieler kauft auf der **Website** → Warenkorb / Checkout
2. Website zeigt: `/pay DeinBot 17500`
3. Spieler zahlt ingame an den Bot-Account
4. **minecraft-bot** erkennt Zahlung → `POST /api/bot/payments/confirm`
5. Website schaltet alle Packs der Bestellung frei

## Anmeldung per Code

1. Code auf Website generieren (Account-Seite)
2. Ingame:
   ```
   /msg DeinBotAccount link ABCD12
   ```
3. Bot → `POST /api/bot/link/redeem` → Account verknüpft

## Bot starten

```bash
cd minecraft-bot
cp .env.example .env
# MC_BOT_USERNAME = gleicher Name wie SHOP_BOT_IGN in backend/.env
# SHOP_API_URL + BOT_API_KEY = wie backend
npm install
npm start
```

## API-Endpunkte (Backend)

| Endpunkt | Wer ruft auf |
|----------|--------------|
| `POST /api/bot/link/redeem` | minecraft-bot / Paper-Plugin |
| `POST /api/bot/payments/confirm` | minecraft-bot / Paper-Plugin |
| `POST /api/bot/vouches/sync` | discord-bot (optional) |
| `GET /api/bot/catalog` | discord-bot (optional, Kategorie-Sync) |

Header bei allen Bot-Requests: `X-Bot-Api-Key: <BOT_API_KEY>`
