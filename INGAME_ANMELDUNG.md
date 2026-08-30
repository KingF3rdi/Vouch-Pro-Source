# Ingame-Anmeldung & Zahlungen (ein Account)

**Kein Server-Zugriff?** → Fabric **Client-Mod**: [`../minecraft-client-mod/`](../minecraft-client-mod/) (läuft beim Spieler, verbunden mit Website).

Der Shop-Bot ist **ein Minecraft-Spieleraccount** für beides:

1. **Anmeldung / Verknüpfung** — `/msg BotName link CODE`
2. **Zahlungen** — `/pay BotName <betrag>`

## Voraussetzungen

- Eigener Minecraft-Account für den Bot (`MC_BOT_USERNAME`)
- Gleicher Name in `backend/.env` als `SHOP_BOT_IGN`
- Bot hat `/msg`-Rechte auf dem Server

## Anmeldung per Code

1. Code auf der Website generieren
2. Ingame:

```
/msg DeinBotAccount link DEINCODE
```

## Zahlung

1. Pack auf der Website kaufen (IGN eingeben) → du erhältst einen **Zahlungscode**
2. Code an Bot senden:
   ```
   /msg DeinBotAccount zahlung AB12CD
   ```
3. Ingame zahlen:
   ```
   /pay DeinBotAccount 17500
   ```
4. Bot synchronisiert Codes von der Website und ordnet die Zahlung automatisch zu.

Der Bot lädt offene Codes alle 20 Sekunden von `GET /api/bot/payments/pending`.

## Bot starten

```bash
cd minecraft-bot
cp .env.example .env
# MC_BOT_USERNAME = dein Bot-IGN
npm install
npm start
```

## Konfiguration

| Variable | Wo | Bedeutung |
|----------|-----|-----------|
| `MC_BOT_USERNAME` | `minecraft-bot/.env` | Bot-Account (Login + Zahlungen) |
| `SHOP_BOT_IGN` | `backend/.env` | Gleicher Name für Website-Anzeige |
| `SHOP_OWNER_IGN` | optional | Nur wenn Zahlungen an anderen Account |

## Dateien

- `index.js` — Bot starten
- `link-auth.js` — Code-Einlösung (Account)
- `payment-code.js` — Zahlungscode von Website entgegennehmen
- `pending-payments.js` — Codes von Website-API synchronisieren
- `payment-handler.js` — Zahlungserkennung am Bot-Account
- `player-messages.js` — Antworten per `/msg`
