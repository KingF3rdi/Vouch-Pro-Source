# Ingame-Anmeldung per Code

Der Shop-Bot ist **kein Server-Plugin**, sondern ein **normaler Minecraft-Spieleraccount**, der dauerhaft auf dem Server online ist (mineflayer).

Spieler schreiben diesem Account per Whisper oder Chat — der Bot liest die Nachrichten und antwortet per `/msg`.

## Voraussetzungen

- Ein **eigener Minecraft-Account** für den Bot (Premium empfohlen)
- Bot-Account hat auf dem Server Rechte für `/msg` (oder `/tell` / `/w`)
- `MC_BOT_USERNAME` in `.env` = exakter IGN des Bot-Accounts
- `SHOP_BOT_IGN` in `backend/.env` = gleicher Name (wird auf der Website angezeigt)

## Ablauf

### Discord + Minecraft verknüpfen

1. Website → **mit Discord anmelden** → Profil
2. **„IGN-Verknüpfungscode generieren“** (15 Min. gültig)
3. Ingame dem Bot-Account schreiben:

```
/msg DeinBotAccount link DEINCODE
```

Alternativ im öffentlichen Chat:

```
!shop link DEINCODE
```

4. Der Bot antwortet per private Nachricht (`/msg`).

### Nur Minecraft (ohne Discord)

1. Website → **„Ingame-Anmeldecode generieren“**
2. Ingame:

```
/msg DeinBotAccount link DEINCODE
```

## Bot starten

```bash
cd minecraft-bot
cp .env.example .env
nano .env   # MC_BOT_USERNAME = dein echter Bot-IGN
npm install
npm start
```

Beim ersten Start mit `MC_AUTH=microsoft` öffnet sich ggf. ein Browser-Login für den Bot-Account.

## `.env` — wichtigste Werte

| Variable | Bedeutung |
|----------|-----------|
| `MC_BOT_USERNAME` | IGN des Bot-Minecraft-Accounts |
| `MC_AUTH` | `microsoft` (Premium) oder `offline` (Cracked) |
| `MC_MSG_CMD` | Whisper-Befehl: `msg`, `tell` oder `w` |
| `SHOP_OWNER_IGN` | Account, **an den** Spieler zahlen (`/pay`) — oft ≠ Bot-Account |
| `BOT_API_KEY` | Identisch mit `backend/.env` |

## Unterstützte Spieler-Eingaben

| Eingabe | Beschreibung |
|---------|--------------|
| `/msg BotName link CODE` | **Empfohlen** — Whisper an Bot-Account |
| `!shop link CODE` | Öffentlicher Chat |
| `!link CODE` | Kurzform |
| `anmelden CODE` | Deutsch |
| `verknüpfen CODE` | Deutsch |

## Fehlerbehebung

| Problem | Lösung |
|---------|--------|
| Bot verbindet nicht | `MC_AUTH=microsoft` + korrekter Account-Name |
| Bot antwortet nicht | Whisper an exakten `MC_BOT_USERNAME` senden |
| Keine private Antwort | Bot braucht `/msg`-Rechte auf dem Server |
| „Code ungültig“ | Neuen Code auf Website erstellen (mit Discord angemeldet) |
| Zwei Accounts verwechselt | `SHOP_OWNER_IGN` = Zahlungsempfänger, `MC_BOT_USERNAME` = Bot |

## Dateien

- `index.js` — Bot verbindet als Spieler, Zahlungen + Link-Codes
- `link-auth.js` — Code-Einlösung
- `player-messages.js` — Antworten per `/msg`
