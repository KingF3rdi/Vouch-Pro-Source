# Ingame-Anmeldung & Zahlungen (ein Account)

**Paper/Spigot-Alternative:** Server-Plugin ohne Bot-Account → [`../minecraft-plugin/`](../minecraft-plugin/).

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

1. Pack auf der Website kaufen (IGN eingeben)
2. Ingame den **Gesamtbetrag** an den Bot-Account zahlen (auch bei mehreren Packs nur **eine** Zahlung):

```
/pay DeinBotAccount 17500
```

3. Bot erkennt die Zahlung und schaltet **alle Packs der Bestellung** frei.

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
- `link-auth.js` — Code-Einlösung
- `payment-handler.js` — Zahlungserkennung am Bot-Account
- `player-messages.js` — Antworten per `/msg`
