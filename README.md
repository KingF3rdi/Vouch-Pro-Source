# TxTEmpire Discord Shop Bot

Discord-Shop mit Kategorien, Warenkorb, Tickets, Pack-Versand und Vouch — synchronisiert mit der TxTEmpire Website.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env
python bot.py
```

## Env

```env
DISCORD_TOKEN=dein_token
GUILD_ID=deine_server_id
SHOP_API_URL=https://shop.deinedomain.de
BOT_API_KEY=gleicher-key-wie-backend
FRONTEND_URL=https://shop.deinedomain.de
```

`DISCORD_TOKEN` sollte mit `DISCORD_BOT_TOKEN` im Website-Backend übereinstimmen (Tickets von der Website).

## Features

- `/setup` — Shop konfigurieren
- `/buypanel` — Kauf-Panels posten
- Tickets mit Zahlungsbestätigung
- `/vouch` — Bewertung (Server + DM + Website-Sync)
- Automatischer Katalog-Sync von der Website

## Website-API

- `GET /api/bot/catalog`
- `POST /api/bot/vouches/sync`
- `POST /api/bot/vouches/submit`

Repository: [txtempire-shop-website](https://github.com/KingF3rdi/txtempire-shop-website)
