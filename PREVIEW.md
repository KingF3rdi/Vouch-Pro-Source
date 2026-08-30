# Vorschau — alles verbunden

## Laufende Server

| Service | URL | Status |
|---------|-----|--------|
| **Website** | http://localhost:3000 | Next.js (Proxy → API) |
| **API** | http://localhost:8000 | FastAPI |

Start: `./scripts/preview.sh`

## Verbundene Komponenten

```
Website (3000) ──proxy──► API (8000) ◄── minecraft-bot
                              ▲
                              └── discord-bot (optional)
                              └── Client-Mod (/api/client/*)
```

### Gemeinsame Konfiguration

| Variable | Wert (Vorschau) | Dateien |
|----------|-----------------|---------|
| `BOT_API_KEY` | `preview-bot-api-key` | `backend/.env`, `minecraft-bot/.env`, `discord-bot/.env` |
| `SHOP_API_URL` | `http://localhost:8000` | Bot `.env` Dateien |
| `SHOP_BOT_IGN` | `TxtEmpire` | `backend/.env` |
| `FRONTEND_URL` | `http://localhost:3000` | `backend/.env` |

## Zahlungs-Flow (ingame)

1. **Website** → Warenkorb → Checkout (ingame) → **Zahlungscode** (z.B. `AB12CD`)
2. **minecraft-bot** holt Codes: `GET /api/bot/payments/pending`
3. Spieler: `/msg TxtEmpire zahlung AB12CD` → `/pay TxtEmpire <betrag>`
4. Bot: `POST /api/bot/payments/confirm` → Packs freigeschaltet

## Bots starten (optional)

```bash
# MC-Bot (mineflayer — braucht echten MC-Server + Account)
cd minecraft-bot && npm install && npm start

# Discord-Bot (braucht DISCORD_TOKEN in discord-bot/.env)
cd discord-bot && pip install -r requirements.txt && python3 bot.py
```

## Client-Mod (fremder Server)

`config/txtshop.json`:
```json
{
  "shop-api-url": "http://localhost:8000",
  "payment-recipient": "TxtEmpire"
}
```

## API testen

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/config/payment
curl -H "X-Bot-Api-Key: preview-bot-api-key" http://localhost:8000/api/bot/catalog
curl -H "X-Bot-Api-Key: preview-bot-api-key" http://localhost:8000/api/bot/payments/pending
```
