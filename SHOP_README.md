# TxTEmpire Shop — Website + Minecraft Bot + Discord Integration

Vollständiges Shop-System mit Website, Ingame-Zahlungserkennung und Anbindung an deinen **bestehenden Discord Bot**.

## Architektur

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Website   │────▶│  Shop API    │◀────│ Discord Bot     │
│  (Next.js)  │     │  (FastAPI)   │     │ (dein Bot +     │
└─────────────┘     └──────┬───────┘     │  Integration)   │
                           │             └─────────────────┘
                    ┌──────▼───────┐
                    │ MC Ingame Bot│
                    │ (mineflayer) │
                    └──────────────┘
```

## Features

| Feature | Beschreibung |
|---------|-------------|
| **IGN Verknüpfung** | Code-basiert wie Discord — Website oder Bot |
| **Discord OAuth** | Discord verbinden → IGN automatisch auf Website |
| **Auto-Payment** | MC Bot erkennt Zahlungen und bestätigt Bestellungen |
| **Bestseller** | Verkaufsstats vom Discord Bot synchronisiert |
| **Neue Produkte** | Eigene Sektion unter Bestsellern |
| **Suche + Kategorien** | Volltextsuche mit Kategorie- und Tag-Filter |
| **Pack-Vorschau** | Bis zu 5 Bilder/Clips, ähnliche Produkte |
| **Tags** | Produkte mit Tags verknüpfen |
| **Einfaches Posting** | Name, Vorschau, Preis, DC Rolle, Tags |
| **Wunschliste** | Favoriten + Discord DM bei Preisänderung |
| **Creator/Rabatt Codes** | 10% Rabatt wie beim DC Bot |
| **Vouches** | 3 Beispiele + Gesamtanzahl, sync vom Bot |
| **Verkaufsstatistik** | Gesamt verkauft + Umsatz oben auf der Seite |

## Schnellstart

### 1. Backend (API)

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

python -m app.seed
uvicorn app.main:app --reload --port 8000
```

### 2. Website

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Website: http://localhost:3000 — **TxTEmpire Shop**

### 3. Minecraft Bot

```bash
cd minecraft-bot
npm install
cp .env.example .env
npm start
```

### 4. Discord Bot Integration

Kopiere `discord_integration/discord_integration.py` in deinen bestehenden Bot und binde `ShopIntegration` ein.

## Discord Commands

| Command | Beschreibung |
|---------|-------------|
| `!shop post Name \| Preis \| RollenID \| Tags \| PreviewURL` | Produkt posten |
| `!shop stats` | Verkaufsstatistiken |
| `!shop linkign [Code] [IGN]` | IGN verknüpfen |
| `!shop syncvouch Name \| Nachricht` | Vouch syncen |
| `!shop price [id] [preis]` | Preis ändern + Wunschlisten DMs |
| `!shop vouches` | Vouch-Übersicht |

## Konfiguration

1. `BOT_API_KEY` in `backend/.env` und `minecraft-bot/.env`
2. Discord OAuth in `backend/.env` (gleiche App wie dein Bot)
3. `discord_integration.py` in deinen Bot kopieren

Wenn du mir deinen Discord Bot gibst, passe ich die Integration direkt an.
