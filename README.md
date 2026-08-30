# TxTEmpire Minecraft Bot

Mineflayer-Bot für ingame Link-Codes und automatische Zahlungszuordnung.

## Features

- Link-Codes: `/msg Bot link CODE`
- Zahlungscodes: `/msg Bot zahlung CODE`
- Erkennt `/pay` und bestätigt Zahlungen an die Website-API
- Synchronisiert offene Zahlungen alle 20s

## Setup

```bash
cp .env.example .env
npm install
npm start
```

## Env

| Variable | Beschreibung |
|----------|--------------|
| `MC_HOST` | Minecraft Server |
| `MC_PORT` | Port (default 25565) |
| `MC_BOT_USERNAME` | Bot-Account |
| `MC_AUTH` | `microsoft` oder `offline` |
| `SHOP_API_URL` | Website-API URL |
| `BOT_API_KEY` | Gleicher Key wie Backend |

## Website-API

- `GET /api/bot/payments/pending`
- `POST /api/bot/payments/confirm`
- `POST /api/bot/link/redeem`

Siehe auch: [INGAME_ANMELDUNG.md](./INGAME_ANMELDUNG.md)
