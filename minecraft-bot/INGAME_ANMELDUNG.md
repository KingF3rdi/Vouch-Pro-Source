# Ingame-Anmeldung per Code (Minecraft Bot)

Der Shop-Bot verknüpft Minecraft-Accounts mit dem Website-Profil über einen **6-stelligen Code**.

## Ablauf

### Discord + Minecraft verknüpfen

1. Auf der Website **mit Discord anmelden** → Profil öffnen.
2. **„IGN-Verknüpfungscode generieren“** klicken (Code ist 15 Minuten gültig).
3. Auf dem Minecraft-Server ingame eingeben:

```
!shop link DEINCODE
```

Alternativ per Whisper:

```
/msg ShopBot link DEINCODE
```

4. Der Bot bestätigt per `/tell`, dass IGN und Discord verbunden sind.

### Nur Minecraft (ohne Discord)

1. Auf der Website im Profil **„Ingame-Anmeldecode generieren“** (ohne Discord).
2. Ingame:

```
!shop link DEINCODE
```

3. Dein IGN wird als Shop-Account registriert — Käufe erscheinen danach im Profil.

## Unterstützte Befehle

| Eingabe | Beschreibung |
|---------|--------------|
| `!shop link CODE` | Hauptbefehl (öffentlicher Chat) |
| `!link CODE` | Kurzform |
| `link CODE` | Ohne Prefix |
| `anmelden CODE` | Deutsch |
| `verknüpfen CODE` | Deutsch |
| `/msg ShopBot link CODE` | Whisper an den Bot |

## Bot starten

```bash
cd minecraft-bot
cp .env.example .env
# MC_HOST, BOT_API_KEY, SHOP_API_URL eintragen
npm install
npm start
```

## API (für eigene Plugins)

```
POST /api/bot/link/redeem
Header: X-Bot-Api-Key: <BOT_API_KEY>
Body: { "code": "ABC123", "ign": "SpielerName" }
```

## Fehlerbehebung

| Problem | Lösung |
|---------|--------|
| „Code ungültig“ | Neuen Code auf der Website erstellen (mit Discord angemeldet) |
| Bot reagiert nicht | Chat muss öffentlich sein oder Whisper an Bot-Namen |
| „Shop-API nicht erreichbar“ | `SHOP_API_URL` und Backend prüfen |
| Code abgelaufen | Codes sind 15 Minuten gültig |

## Dateien

- `index.js` — Payment-Bot + Link-Auth
- `link-auth.js` — Code-Einlösung ingame
