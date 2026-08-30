# TxTEmpire Shop — Website

Next.js Frontend + FastAPI Backend für den TxTEmpire Minecraft Shop.

## Struktur

| Ordner | Beschreibung |
|--------|--------------|
| `frontend/` | Next.js Website (:3000) |
| `backend/` | FastAPI REST API (:8000) |
| `scripts/preview.sh` | Lokale Vorschau starten |

## Schnellstart

```bash
# Backend
cd backend
cp .env.example .env
pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend (neues Terminal)
cd frontend
npm install
npm run dev
```

Website: http://localhost:3000  
API: http://localhost:8000

Details: [PREVIEW.md](./PREVIEW.md)

## Bot-Anbindung

Setze in `backend/.env`:

```
BOT_API_KEY=dein-geheimer-key
SHOP_BOT_IGN=TxtEmpire
FRONTEND_URL=http://localhost:3000
```

Discord- und Minecraft-Bot nutzen denselben `BOT_API_KEY` und `SHOP_API_URL`.

## API-Überblick

| Pfad | Beschreibung |
|------|--------------|
| `/api/shop/*` | Produkte, Warenkorb, Checkout |
| `/api/bot/*` | Bot-Integration (API-Key) |
| `/api/client/*` | Fabric Client-Mod |
| `/api/user/*` | Profil, Vouches, Wunschliste |
