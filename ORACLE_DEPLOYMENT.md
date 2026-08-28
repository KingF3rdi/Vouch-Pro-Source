# TxTEmpire Shop — Oracle Cloud Hosting + MC Payment Bot + Discord

Diese Anleitung beschreibt, wie du die Website auf **Oracle Cloud (OCI)** hostest, den **Minecraft Ingame-Bot** für Zahlungsüberwachung einrichtest und alles mit **Discord** verbindest.

---

## Architektur (Überblick)

```
Spieler (Browser)          Discord (Tickets / OAuth)
       │                            │
       ▼                            ▼
┌────────────── Oracle VM ──────────────┐
│  Nginx (443) → Next.js (3000)         │
│              → FastAPI (8000)         │
│  SQLite + Uploads                     │
└──────────────┬────────────────────────┘
               │ X-Bot-Api-Key
       ┌───────┴────────┐
       ▼                ▼
 MC Payment Bot    Dein Discord Bot
 (mineflayer)      (discord.py + ShopIntegration)
       │
       ▼
 Minecraft Server (Zahlungen im Chat)
```

**Zahlungsablauf:**

1. Spieler kauft auf der Website → Discord-Ticket wird erstellt (Betrag + IGN).
2. Spieler zahlt ingame (z. B. `/pay ShopOwner 10k`).
3. Der **MC-Bot** liest die Chat-Nachricht, ruft `POST /api/bot/payments/confirm` auf.
4. Die API findet die offene Bestellung (IGN + Betrag) und schaltet das Pack frei.

---

## Teil 1 — Oracle Cloud VM

### 1.1 Instanz erstellen

1. [Oracle Cloud Console](https://cloud.oracle.com/) → **Compute** → **Instances** → **Create instance**.
2. **Image:** Ubuntu 22.04 oder 24.04.
3. **Shape:** Ampere A1 (Always Free) reicht für Shop + API + Frontend.
4. **Networking:** Public IP zuweisen.
5. **SSH-Key** hinzufügen und Instanz starten.

### 1.2 Firewall (OCI + OS)

**OCI Security List / NSG** (eingehend):

| Port | Zweck |
|------|--------|
| 22   | SSH |
| 80   | HTTP (Let's Encrypt) |
| 443  | HTTPS (Website) |

Port **8000** nicht öffentlich öffnen — API nur über Nginx (`/api`) oder intern.

**Auf der VM (iptables/ufw):**

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 1.3 Basis-Pakete

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nginx certbot python3-certbot-nginx \
  python3-pip python3-venv nodejs npm
```

Node 20+ empfohlen (falls `nodejs` zu alt: [NodeSource](https://github.com/nodesource/distributions)).

```bash
sudo npm install -g pm2
```

### 1.4 Repository

```bash
cd ~
git clone https://github.com/KingF3rdi/Vouch-Pro-Source.git txtempire-shop
cd txtempire-shop
```

---

## Teil 2 — Backend (Shop API)

```bash
cd ~/txtempire-shop/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

**`backend/.env` (Produktion — Beispiel):**

```env
DATABASE_URL=sqlite+aiosqlite:///./shop.db
SECRET_KEY=<langer-zufälliger-string>

# Gleicher Key in MC-Bot und Discord-Bot!
BOT_API_KEY=<starker-zufälliger-key>

DISCORD_CLIENT_ID=<discord-app-client-id>
DISCORD_CLIENT_SECRET=<discord-app-client-secret>
DISCORD_REDIRECT_URI=https://shop.deinedomain.de/api/auth/discord/callback
DISCORD_BOT_TOKEN=<bot-token>
DISCORD_GUILD_ID=<server-id>
DISCORD_TICKET_CATEGORY_ID=<ticket-kategorie-channel-id>
DISCORD_PURCHASE_LOG_CHANNEL_ID=<log-channel-id>
DISCORD_INVITE_URL=https://discord.gg/xxxxx

FRONTEND_URL=https://shop.deinedomain.de

ADMIN_DISCORD_IDS=123456789012345678,987654321098765432
```

**Optional Seed (nur beim ersten Setup):**

```bash
python -m app.seed
```

**API mit PM2:**

```bash
cd ~/txtempire-shop/backend
source venv/bin/activate
pm2 start "uvicorn app.main:app --host 127.0.0.1 --port 8000" --name shop-api
pm2 save
```

---

## Teil 3 — Frontend (Website)

```bash
cd ~/txtempire-shop/frontend
npm install
cp .env.example .env.local
```

**`frontend/.env.local`:**

```env
NEXT_PUBLIC_API_URL=https://shop.deinedomain.de
```

Build & Start:

```bash
npm run build
pm2 start npm --name shop-web -- start
pm2 save
```

`next.config.js` leitet `/api/*` intern auf `localhost:8000` — Backend und Frontend müssen auf **derselben VM** laufen.

---

## Teil 4 — Nginx + HTTPS

`/etc/nginx/sites-available/txtempire-shop`:

```nginx
server {
    listen 80;
    server_name shop.deinedomain.de;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/txtempire-shop /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d shop.deinedomain.de
```

---

## Teil 5 — Minecraft Payment Bot

Der Bot liegt im Repo unter `minecraft-bot/index.js`. Er verbindet sich mit deinem MC-Server, erkennt Zahlungs-Nachrichten im Chat und bestätigt Bestellungen über die API.

### 5.1 Installation

```bash
cd ~/txtempire-shop/minecraft-bot
npm install
cp .env.example .env
```

### 5.2 Konfiguration `minecraft-bot/.env`

```env
MC_HOST=dein-mc-server.de
MC_PORT=25565
MC_BOT_USERNAME=TxTEmpirePayBot
MC_AUTH=offline
SHOP_API_URL=https://shop.deinedomain.de
BOT_API_KEY=<gleicher-key-wie-backend>
SHOP_OWNER_IGN=DeinShopOwnerIGN
```

| Variable | Erklärung |
|----------|-----------|
| `MC_HOST` | IP/Hostname deines Minecraft-Servers |
| `MC_AUTH` | `offline` für Cracked/offline-Server, für Online-Mode Microsoft-Auth nötig |
| `SHOP_API_URL` | Öffentliche Shop-URL (ohne trailing slash) |
| `BOT_API_KEY` | Muss **identisch** mit `backend/.env` sein |
| `SHOP_OWNER_IGN` | IGN des Accounts, an den Spieler zahlen |

### 5.3 Bot starten (PM2)

```bash
cd ~/txtempire-shop/minecraft-bot
pm2 start index.js --name mc-payment-bot
pm2 save
pm2 startup
```

**Hinweis:** Der MC-Bot kann auf der Oracle-VM laufen, solange er den MC-Server erreicht (Port 25565). Alternativ auf dem **MC-Server-Host** installieren und `SHOP_API_URL` auf die öffentliche Shop-URL setzen.

### 5.4 Erkannte Zahlungsformate

Der Bot parst u. a.:

- `SpielerName pay 10.50`
- `SpielerName paid ShopOwner 10.50`
- `SpielerName paid you $10.00` (EssentialsX)
- `[Payment] Spieler 10.00`

**Wichtig:** Der Betrag in der Bestellung muss exakt dem ingame-Zahlungsbetrag entsprechen (nach Rabatt). Produkte in der API mit dem gleichen Zahlenwert anlegen (z. B. Preis `10000` wenn ingame `10k` = 10000 Coins).

### 5.5 Vollständiges Bot-Script

Das Script ist `minecraft-bot/index.js` im Repository. Kurzversion der Logik:

```javascript
// Bestätigung an API senden
async function confirmPayment(ign, amount, reference) {
  const res = await fetch(`${CONFIG.apiUrl}/api/bot/payments/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Bot-Api-Key': CONFIG.apiKey,
    },
    body: JSON.stringify({
      ign,
      amount: parseFloat(amount),
      payment_reference: reference,
    }),
  });
  return await res.json();
}

// Bei erkanntem Payment im Chat
bot.on('chat', async (username, message) => {
  const payment = parsePayment(message);
  if (!payment) return;
  const result = await confirmPayment(payment.ign, payment.amount, message);
  if (result.success) {
    bot.chat(`/tell ${payment.ign} Zahlung bestätigt! Bestellung #${result.order_id}`);
  }
});
```

---

## Teil 6 — Discord konfigurieren

### 6.1 Discord Developer Portal

1. [Discord Developer Portal](https://discord.com/developers/applications) → deine App (gleiche wie dein Bot).
2. **OAuth2 → Redirects** hinzufügen:
   - `https://shop.deinedomain.de/api/auth/discord/callback`
3. **Scopes** für Login: `identify`
4. **Bot** → Token kopieren → `DISCORD_BOT_TOKEN` in `backend/.env`

### 6.2 Server-IDs finden

- **Guild ID:** Discord → Server → Entwicklermodus → Rechtsklick Server → ID kopieren → `DISCORD_GUILD_ID`
- **Ticket-Kategorie:** Rechtsklick auf Kategorie-Channel → ID → `DISCORD_TICKET_CATEGORY_ID`
- **Log-Channel:** ID des Channels für Kauf-Bestätigungen → `DISCORD_PURCHASE_LOG_CHANNEL_ID`

### 6.3 Shop in deinen Discord-Bot einbinden

Kopiere `discord_integration/discord_integration.py` in deinen Bot (oder nutze `shop_bridge.py`).

**Umgebungsvariablen für den Discord-Bot:**

```env
SHOP_API_URL=https://shop.deinedomain.de
BOT_API_KEY=<gleicher-key-wie-backend>
```

**Minimal-Beispiel (`main.py`):**

```python
import os
from discord_integration.discord_integration import ShopIntegration

shop = ShopIntegration(
    api_url=os.getenv("SHOP_API_URL", "https://shop.deinedomain.de"),
    api_key=os.getenv("BOT_API_KEY"),
)

class DiscordBot(discord.Client):
    async def on_message(self, message):
        if message.author == self.user:
            return
        if await shop.handle_command(message):
            return
        # ... deine anderen Commands ...
```

Oder mit `shop_bridge.py`:

```python
from shop_bridge import handle_shop_command

async def on_message(self, message):
    if await handle_shop_command(message):
        return
```

### 6.4 Discord Commands (Shop)

| Command | Beschreibung |
|---------|--------------|
| `!shop post Name \| Preis \| RollenID \| Tags \| PreviewURL` | Produkt anlegen |
| `!shop stats` | Verkaufsstatistiken |
| `!shop linkign Code IGN` | IGN mit Discord verknüpfen |
| `!shop syncvouch Name \| Nachricht` | Vouch syncen |
| `!shop price product_id preis` | Preis ändern |
| `!shop complete order_id` | Bestellung manuell abschließen |
| `!shop vouches` | Vouch-Übersicht |

### 6.5 Website ↔ Discord Flow

| Feature | Konfiguration |
|---------|----------------|
| Discord Login | OAuth in `backend/.env` |
| Kauf-Tickets | `DISCORD_BOT_TOKEN` + `DISCORD_GUILD_ID` + `DISCORD_TICKET_CATEGORY_ID` |
| Kauf-Logs | `DISCORD_PURCHASE_LOG_CHANNEL_ID` |
| Admin-Panel | `ADMIN_DISCORD_IDS` (deine Discord User-ID) |
| Server-Invite Button | `DISCORD_INVITE_URL` |

Spieler müssen **Discord im Profil verbinden**, bevor sie kaufen können. IGN und Rabattcode werden **an der Kasse (Warenkorb)** eingegeben.

---

## Teil 7 — Checkliste (alles muss zusammenpassen)

| Setting | Wo | Muss gleich sein |
|---------|-----|------------------|
| `BOT_API_KEY` | `backend/.env`, `minecraft-bot/.env`, Discord-Bot | ✅ identisch |
| `SHOP_API_URL` | MC-Bot, Discord-Bot | öffentliche Shop-URL |
| `FRONTEND_URL` | `backend/.env` | `https://shop.deinedomain.de` |
| `DISCORD_REDIRECT_URI` | Discord Portal + `backend/.env` | exakt gleiche URL |
| Produktpreis | API / Admin | = ingame Zahlungsbetrag |

---

## Teil 8 — Dienste prüfen

```bash
pm2 status
curl -s https://shop.deinedomain.de/api/health
curl -s -H "X-Bot-Api-Key: <key>" https://shop.deinedomain.de/api/bot/stats
```

**Test-Zahlung:**

1. Discord verbinden → Produkt in Warenkorb → Kasse → Ticket öffnen.
2. Mit dem **gleichen IGN** und **gleichem Betrag** ingame zahlen.
3. MC-Bot-Logs: `pm2 logs mc-payment-bot`
4. Bestellung sollte `confirmed` werden; Pack erscheint im Profil.

---

## Teil 9 — Troubleshooting

| Problem | Lösung |
|---------|--------|
| Website lädt, API Fehler | `pm2 logs shop-api`, Backend läuft? |
| OAuth Redirect Fehler | Redirect-URL im Discord Portal = `DISCORD_REDIRECT_URI` |
| Kein Discord-Ticket | `DISCORD_BOT_TOKEN`, Guild-ID, Ticket-Kategorie prüfen |
| MC-Bot erkennt keine Zahlung | Chat-Format mit `parsePayment` abgleichen, Logs prüfen |
| Zahlung erkannt, keine Bestellung | IGN + Betrag müssen exakt zur offenen Order passen |
| 401 auf Bot-API | `BOT_API_KEY` stimmt nicht überein |
| MC-Bot kann nicht joinen | Firewall 25565, `MC_AUTH`, Bot-Account whitelist |

---

## Dateien im Repo

| Pfad | Zweck |
|------|--------|
| `backend/` | FastAPI Shop API |
| `frontend/` | Next.js Website |
| `minecraft-bot/index.js` | Ingame Payment Bot |
| `discord_integration/discord_integration.py` | Discord Shop Commands |
| `shop_bridge.py` | Bridge für bestehenden Bot |
| `SHOP_README.md` | Kurz-Übersicht |

---

*TxTEmpire Shop — Oracle Deployment Guide*
