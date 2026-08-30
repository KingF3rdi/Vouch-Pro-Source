# TxT Shop — Paper Server-Plugin

Ersetzt den **Mineflayer-Bot-Account** auf Paper/Spigot-Servern. Kein extra Minecraft-Account nötig — läuft direkt auf dem Server.

## Funktionen

| Feature | Befehl / Erkennung |
|---------|-------------------|
| **Account verknüpfen** | `/shop link <CODE>` |
| **Zahlung bestätigen** | `/pay TxtEmpire <betrag>` (EssentialsX & Co.) |
| **Chat-Fallback** | Essentials „Spieler paid you $10“ |

Nutzt dieselbe Website-API wie `minecraft-bot/`:
- `POST /api/bot/link/redeem`
- `POST /api/bot/payments/confirm`

## Build

```bash
cd minecraft-plugin
./gradlew pluginJar
# → build/libs/TxTShop-1.0.0.jar
```

Java 17+ erforderlich. Gradle Wrapper wird beim ersten Build erzeugt.

## Installation

1. **Paper 1.20.4+** (oder kompatibler Spigot-Fork)
2. JAR nach `plugins/TxTShop-1.0.0.jar`
3. Server neu starten
4. `plugins/TxTShop/config.yml` anpassen:

```yaml
shop-api-url: "https://shop.deinedomain.de"
bot-api-key: "gleicher-key-wie-backend"
payment-recipient: "TxtEmpire"
```

5. In `backend/.env` denselben Namen als `SHOP_BOT_IGN` / `PAYMENT_RECIPIENT_IGN` setzen

## Spieler-Befehle

```
/shop link ABCD12     — Website-Code einlösen
/shop status          — API-Status
```

Alias: `/txshop`, `/txtshop`

## Admin

```
/shop reload          — config.yml neu laden (Permission: txtshop.admin)
```

## Mineflayer-Bot vs. Plugin

| | Mineflayer (`minecraft-bot/`) | Paper-Plugin (`minecraft-plugin/`) |
|--|-------------------------------|-------------------------------------|
| Extra MC-Account | Ja | Nein |
| Server-Typ | Beliebig (Bot joint als Spieler) | Paper/Spigot |
| EssentialsX `/pay` | Chat-Erkennung | Command + Chat |
| Empfohlen für | Server ohne Plugin-Zugriff | Eigener Paper-Server |

## Hinweis

Das ist ein **Server-Plugin** (Paper), kein Client-Mod. Spieler müssen nichts installieren — nur `/shop link` und `/pay` ingame nutzen.
