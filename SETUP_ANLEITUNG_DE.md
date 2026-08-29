# TxTEmpire Shop — Setup-Anleitung (Oracle + Discord Bot + MC Payment)

**Zweck:** Diese Datei ist dein **separates Setup-Dokument**. Du kannst sie 1:1 in einen anderen Chat kopieren oder Schritt für Schritt abarbeiten.

---

## Was du am Ende hast

| Komponente | Wo läuft | Aufgabe |
|------------|----------|---------|
| **Website** (Next.js) | Oracle VM | Shop-Oberfläche |
| **Shop API** (FastAPI) | Oracle VM | Bestellungen, OAuth, Tickets |
| **Dein Discord Bot** | Beliebig (z. B. MC-Host) | `!shop` Commands, Vouch-Sync |
| **MC Payment Bot** | Oracle VM oder MC-Host | Erkennt ingame-Zahlungen |

---

## Architektur

```
                    ┌─────────────────────────────────┐
                    │         Oracle Cloud VM         │
                    │  Nginx (443)                    │
                    │    → Next.js (3000)  Website    │
                    │    → FastAPI (8000)  Shop API   │
                    └────────────┬────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
     Dein Discord Bot    MC Payment Bot     Discord API
     (!shop, Vouches)    (mineflayer)       (Tickets, OAuth)
              │                  │
              │                  ▼
              │         Minecraft Server
              │         (Spieler zahlen ingame)
              ▼
         Discord Server
         (Tickets, Rollen, Logs)
```

### Zahlungsablauf (Schritt für Schritt)

1. Spieler verbindet **Discord** auf der Website (Profil).
2. Spieler klickt Produkt → **In den Warenkorb** oder **Jetzt kaufen**.
3. Auf der **Kasse**: IGN + optional Rabattcode → **Bezahlen**.
4. Shop API erstellt **Discord-Ticket** (Channel mit Bestellinfos).
5. Spieler zahlt ingame an deinen Shop-Account (z. B. `/pay ShopOwner 10000`).
6. **MC Payment Bot** liest Chat → ruft API `payments/confirm` auf.
7. API matcht IGN + Betrag → Pack wird freigeschaltet → Discord-Rolle / Profil.

---

# TEIL A — Oracle Cloud (Website + API)

## A1. VM erstellen

1. [Oracle Cloud](https://cloud.oracle.com/) → Compute → Instances → Create.
2. Ubuntu 22.04/24.04, Shape **Ampere A1** (Free Tier).
3. Public IP aktivieren, SSH-Key hinterlegen.

## A2. Ports öffnen

| Port | Zweck |
|------|--------|
| 22 | SSH |
| 80 | HTTP (Certbot) |
| 443 | HTTPS (Shop) |

**Nicht** Port 8000 öffentlich — API nur intern.

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

## A3. Software installieren

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nginx certbot python3-certbot-nginx python3-pip python3-venv nodejs npm
sudo npm install -g pm2
```

## A4. Projekt clonen

```bash
cd ~
git clone https://github.com/KingF3rdi/Vouch-Pro-Source.git txtempire-shop
cd txtempire-shop
```

## A5. Backend (Shop API)

```bash
cd ~/txtempire-shop/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
nano .env   # siehe A7
```

Start mit PM2:

```bash
pm2 start "uvicorn app.main:app --host 127.0.0.1 --port 8000" --name shop-api
```

## A6. Frontend (Website)

```bash
cd ~/txtempire-shop/frontend
npm install
cp .env.example .env.local
nano .env.local
```

In `.env.local`:

```env
NEXT_PUBLIC_API_URL=https://shop.deinedomain.de
```

```bash
npm run build
pm2 start npm --name shop-web -- start
pm2 save && pm2 startup
```

## A7. Backend `.env` (wichtig!)

Ersetze `shop.deinedomain.de` mit deiner echten Domain.

```env
DATABASE_URL=sqlite+aiosqlite:///./shop.db
SECRET_KEY=hier-ein-langer-zufalls-string

# === MUSS in MC-Bot + Discord-Bot identisch sein ===
BOT_API_KEY=hier-starker-api-key-min-32-char

# === Discord OAuth (Website Login) ===
DISCORD_CLIENT_ID=deine-app-client-id
DISCORD_CLIENT_SECRET=dein-client-secret
DISCORD_REDIRECT_URI=https://shop.deinedomain.de/api/auth/discord/callback

# === Gleicher Bot wie dein bestehender Discord Bot ===
DISCORD_BOT_TOKEN=dein-bot-token
DISCORD_GUILD_ID=deine-server-id
DISCORD_TICKET_CATEGORY_ID=id-der-ticket-kategorie
DISCORD_PURCHASE_LOG_CHANNEL_ID=id-des-log-channels
DISCORD_INVITE_URL=https://discord.gg/xxxxx

FRONTEND_URL=https://shop.deinedomain.de

# Deine Discord User-ID für /admin
ADMIN_DISCORD_IDS=123456789012345678
```

**IDs finden:** Discord → Einstellungen → App → Entwicklermodus → Rechtsklick → ID kopieren.

## A8. Nginx + HTTPS

Datei `/etc/nginx/sites-available/txtempire-shop`:

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

## A9. Test

```bash
curl https://shop.deinedomain.de/api/health
# Erwartung: {"status":"ok"}
```

---

# TEIL B — Deinen Discord Bot anbinden

Dein Bot liegt im Repo bereits mit Shop-Bridge (`main.py` + `shop_bridge.py`). Er muss nur **konfiguriert** und mit der **öffentlichen Shop-URL** verbunden werden.

## B1. Benötigte Dateien (in deinem Bot-Ordner)

| Datei | Zweck |
|-------|--------|
| `discord_integration/discord_integration.py` | Shop-API Client + `!shop` Commands |
| `shop_bridge.py` | Einfache Bridge für `main.py` |
| `config.py` | `SHOP_API_URL` + `BOT_API_KEY` |

Falls noch nicht vorhanden: aus dem Repo kopieren.

## B2. `config.py` anpassen

```python
import os

DISCORD_TOKEN = 'dein-bot-token'   # wie in backend/.env

# Shop API (Oracle)
SHOP_API_URL = os.getenv('SHOP_API_URL', 'https://shop.deinedomain.de')
BOT_API_KEY = os.getenv('BOT_API_KEY', 'gleicher-key-wie-backend')
DISCORD_INVITE_URL = 'https://discord.gg/xxxxx'
```

Oder per Umgebungsvariable beim Start:

```bash
export SHOP_API_URL=https://shop.deinedomain.de
export BOT_API_KEY=dein-api-key
python main.py
```

## B3. `main.py` — Shop-Commands (bereits eingebaut)

Dein Bot fängt `!shop` ab **bevor** andere Commands:

```python
import shop_bridge

async def on_message(self, message):
    if message.author == self.user:
        return

    # TxTEmpire Shop (!shop post, !shop stats, ...)
    if message.content.strip().lower().startswith('!shop'):
        if await shop_bridge.handle_shop_command(message):
            return

    # ... deine +vouch, +dwc Commands ...
```

**Kein Prefix-Wechsel nötig** — Shop nutzt `!shop`, dein Bot nutzt `+` für andere Commands.

## B4. Vouches automatisch zur Website syncen

In `adminCommands.py` (bei Vouch-Freigabe) ist bereits:

```python
await shop_bridge.sync_vouch_to_shop(
    giverUser.name,
    vouch.message,
    vouch.isPositive,
    vouchID,
)
```

→ Freigegebene Vouches erscheinen auf der Website.

## B5. Shop-Commands (`!shop`)

| Command | Wer | Beschreibung |
|---------|-----|--------------|
| `!shop post Name \| Preis \| RollenID \| Tags \| PreviewURL` | Admin | Produkt anlegen |
| `!shop stats` | Alle | Verkäufe / Umsatz / Vouches |
| `!shop linkign Code IGN` | Alle | IGN mit Discord verknüpfen |
| `!shop syncvouch Name \| Text` | Alle | Vouch manuell syncen |
| `!shop price 3 15000` | Admin | Preis ändern (ID + Betrag) |
| `!shop complete 42` | Admin | Bestellung #42 abschließen |
| `!shop vouches` | Alle | Vouch-Übersicht |

## B6. Discord Developer Portal

1. **OAuth2 → Redirects:** `https://shop.deinedomain.de/api/auth/discord/callback`
2. **Bot Token** = identisch in `backend/.env` und deinem Bot (`DISCORD_TOKEN`)
3. Bot braucht Rechte: Kanäle erstellen, Nachrichten senden, Rollen verwalten

**Wichtig:** Die Shop API nutzt `DISCORD_BOT_TOKEN` um **Kauf-Tickets** zu erstellen. Es muss der **gleiche Bot** sein wie dein laufender Discord Bot.

## B7. Bot starten (Beispiel PM2)

```bash
cd ~/dein-discord-bot
pip install httpx discord.py
pm2 start main.py --name discord-bot --interpreter python3
```

---

# TEIL C — Minecraft Payment Bot (Ingame Script)

## C1. Was das Script macht

- Verbindet sich mit deinem MC-Server (mineflayer).
- Liest **öffentlichen Chat** und System-Nachrichten.
- Erkennt Zahlungs-Muster (EssentialsX, Vault, etc.).
- Sendet `POST /api/bot/payments/confirm` mit **IGN + Betrag**.
- API findet offene Bestellung → schaltet Pack frei.
- **Neu:** Ingame-Anmeldung per Code (`!shop link CODE`) → `POST /api/bot/link/redeem`.

Details: `minecraft-bot/INGAME_ANMELDUNG.md`

## C2. Installation

```bash
cd ~/txtempire-shop/minecraft-bot
npm install
cp .env.example .env
nano .env
```

## C3. `minecraft-bot/.env`

```env
MC_HOST=ip-oder-hostname-deines-mc-servers
MC_PORT=25565
MC_BOT_USERNAME=TxTEmpirePayBot
MC_AUTH=offline
SHOP_API_URL=https://shop.deinedomain.de
BOT_API_KEY=gleicher-key-wie-backend
SHOP_OWNER_IGN=DeinShopOwnerIGN
```

| Variable | Erklärung |
|----------|-----------|
| `MC_AUTH` | `offline` = Cracked/Offline-Server. Online-Mode = Microsoft-Login nötig |
| `SHOP_OWNER_IGN` | Account, an den Spieler `/pay` senden |
| `BOT_API_KEY` | **Identisch** mit `backend/.env` |

## C4. Script starten

```bash
pm2 start index.js --name mc-payment-bot
pm2 logs mc-payment-bot
```

**Wo läuft der Bot?**

- **Option A:** Oracle VM (wenn Port 25565 zum MC-Server offen ist).
- **Option B:** Auf dem MC-Server-Host (empfohlen) — `SHOP_API_URL` bleibt die öffentliche Shop-URL.

## C5. Vollständiges Script (`minecraft-bot/index.js`)

Das Script liegt im Repo. Hier die **komplette Datei** zum Kopieren:

```javascript
require('dotenv').config();
const mineflayer = require('mineflayer');

const CONFIG = {
  host: process.env.MC_HOST || 'localhost',
  port: parseInt(process.env.MC_PORT || '25565', 10),
  username: process.env.MC_BOT_USERNAME || 'ShopBot',
  auth: process.env.MC_AUTH || 'offline',
  apiUrl: process.env.SHOP_API_URL || 'http://localhost:8000',
  apiKey: process.env.BOT_API_KEY || 'change-bot-api-key',
  paymentPrefix: process.env.PAYMENT_PREFIX || 'pay',
  shopOwnerIgn: process.env.SHOP_OWNER_IGN || 'ShopOwner',
};

const PAYMENT_PATTERNS = [
  /^(\w+)\s+pay\s+(\d+(?:\.\d{1,2})?)$/i,
  /^(\w+)\s+paid\s+\w+\s+(\d+(?:\.\d{1,2})?)$/i,
  /^(\w+)\s+paid\s+you\s+\$?(\d+(?:\.\d{1,2})?)$/i,
  /^(\w+)\s*->\s*\w+:\s*\$?(\d+(?:\.\d{1,2})?)$/i,
  /^\[Payment\]\s+(\w+)\s+\$?(\d+(?:\.\d{1,2})?)$/i,
];

async function confirmPayment(ign, amount, reference) {
  try {
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
  } catch (err) {
    console.error('[API] Fehler:', err.message);
    return { success: false };
  }
}

function parsePayment(message) {
  const clean = message.replace(/\§./g, '').trim();
  for (const pattern of PAYMENT_PATTERNS) {
    const match = clean.match(pattern);
    if (match) return { ign: match[1], amount: parseFloat(match[2]) };
  }
  const payCmd = clean.match(/^pay\s+(\w+)\s+(\d+(?:\.\d{1,2})?)$/i);
  if (payCmd) {
    return { ign: CONFIG.lastCommandSender || 'unknown', amount: parseFloat(payCmd[2]) };
  }
  return null;
}

const bot = mineflayer.createBot({
  host: CONFIG.host,
  port: CONFIG.port,
  username: CONFIG.username,
  auth: CONFIG.auth,
});

bot.on('login', () => console.log(`[Bot] Online: ${bot.username}`));
bot.on('spawn', () => console.log('[Bot] Warte auf Zahlungen...'));

bot.on('chat', async (username, message) => {
  if (username === bot.username) return;
  const payment = parsePayment(message);
  if (!payment) return;
  console.log(`[Payment] ${payment.ign} → ${payment.amount}`);
  const result = await confirmPayment(payment.ign, payment.amount, message);
  if (result.success) {
    bot.chat(`/tell ${payment.ign} Zahlung bestätigt! Bestellung #${result.order_id}`);
  }
});

bot.on('messagestr', async (message) => {
  const payment = parsePayment(message);
  if (!payment) return;
  const result = await confirmPayment(payment.ign, payment.amount, message);
  if (result.success) console.log(`[Payment] Order #${result.order_id} bestätigt`);
});

bot.on('end', () => {
  console.log('[Bot] Reconnect in 10s...');
  setTimeout(() => {
    require('child_process').spawn(process.argv[0], process.argv.slice(1), { stdio: 'inherit' });
    process.exit();
  }, 10000);
});
```

## C6. Erkannte Chat-Formate

| Chat-Nachricht | Erkannt? |
|----------------|----------|
| `MaxMC paid ShopOwner 10000` | ✅ |
| `MaxMC paid you $10000` | ✅ (EssentialsX) |
| `[Payment] MaxMC 10000` | ✅ |
| `/pay ShopOwner 10000` (als Whisper) | ✅ |

**Wenn dein Pay-Plugin anders formatiert:** Pattern in `PAYMENT_PATTERNS` in `index.js` ergänzen.

## C7. Preis = ingame Betrag

Die API matcht **exakt** IGN + Betrag der offenen Bestellung.

| Shop-Produktpreis | Spieler zahlt ingame |
|-------------------|----------------------|
| `10000` | `10000` Coins |
| `9.99` | `9.99` |

Rabattcode auf der Kasse reduziert den Order-Betrag — Spieler muss den **reduzierten** Betrag zahlen.

---

# TEIL D — Alles verknüpfen (Checkliste)

## D1. Drei Keys / URLs müssen übereinstimmen

| Wert | Dateien |
|------|---------|
| `BOT_API_KEY` | `backend/.env`, `minecraft-bot/.env`, Discord `config.py` / env |
| `SHOP_API_URL` | `minecraft-bot/.env`, Discord `config.py` |
| `DISCORD_BOT_TOKEN` | `backend/.env`, Discord `config.py` |
| `DISCORD_REDIRECT_URI` | Discord Portal + `backend/.env` |
| `FRONTEND_URL` | `backend/.env` = `https://shop.deinedomain.de` |

## D2. End-to-End Test

1. `curl https://shop.deinedomain.de/api/health` → `ok`
2. Website öffnen → Discord verbinden (Profil)
3. Produkt → Warenkorb → Kasse → IGN eintragen → Bezahlen
4. Discord-Ticket erscheint mit Betrag
5. Ingame mit **gleichem IGN** und **gleichem Betrag** zahlen
6. `pm2 logs mc-payment-bot` → `Bestätigt: Order #...`
7. Pack erscheint im Website-Profil

## D3. PM2 Status (alle Dienste)

```bash
pm2 status
# shop-api, shop-web, mc-payment-bot, discord-bot
```

---

# TEIL E — Häufige Probleme

| Problem | Lösung |
|---------|--------|
| OAuth Fehler | Redirect-URL im Portal = `DISCORD_REDIRECT_URI` |
| Kein Ticket | `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, Ticket-Kategorie prüfen |
| Bot API 401 | `BOT_API_KEY` nicht identisch |
| Zahlung erkannt, keine Order | IGN oder Betrag stimmt nicht mit Kasse überein |
| MC-Bot disconnected | Whitelist, Firewall 25565, `MC_AUTH` |
| `!shop` keine Antwort | `SHOP_API_URL` erreichbar? `httpx` installiert? |

---

**Repo-Dateien:** `ORACLE_DEPLOYMENT.md` (engl. Kurzversion), `SHOP_README.md`, `minecraft-bot/index.js`, `discord_integration/discord_integration.py`, `shop_bridge.py`, `main.py`

*TxTEmpire — Setup Anleitung DE*
