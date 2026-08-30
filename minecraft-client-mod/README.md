# TxT Shop — Fabric Client-Mod

**Client-seitig** — funktioniert auf **fremden Servern**, ohne Server-Plugin oder Bot-Account.

Verbindet deinen Minecraft-Client direkt mit der **Website-API**.

## Voraussetzungen

- **Minecraft 1.20.1**
- **Fabric Loader** + **Fabric API**
- Shop-Website mit Backend (`/api/client/*` Endpunkte)

## Installation

1. [Fabric](https://fabricmc.net/use/) für 1.20.1 installieren
2. [Fabric API](https://modrinth.com/mod/fabric-api) laden
3. `TxTShopClient-1.0.0.jar` in den Ordner `mods/`
4. Spiel starten → `config/txtshop.json` wird automatisch erstellt
5. `shop-api-url` auf deine Website setzen

```json
{
  "shop-api-url": "https://shop.deinedomain.de",
  "payment-recipient": "TxtEmpire"
}
```

**Kein API-Key im Mod nötig** — sichere Client-Endpunkte mit Rate-Limit.

## Nutzung ingame

| Aktion | Wie |
|--------|-----|
| **Account verknüpfen** | Taste **L** → Code von Website eingeben |
| **Status** | Taste **K** → API + Zahlungsempfänger anzeigen |
| **Zahlung melden** | Normal `/pay TxtEmpire 17500` — Mod meldet an Website |

## Ablauf

1. Auf **Website** kaufen (Checkout mit deinem IGN)
2. Ingame `/pay <Empfänger> <Betrag>` wie auf der Website angezeigt
3. Mod erkennt den `/pay`-Befehl → `POST /api/client/payment/confirm`
4. Website schaltet Packs frei

## Build

```bash
cd minecraft-client-mod
./gradlew build
# → build/libs/TxTShopClient-1.0.0.jar
```

## vs. andere Lösungen

| Lösung | Server-Zugriff | Wer installiert |
|--------|------------------|-----------------|
| **Client-Mod** (hier) | Nein | Jeder Käufer |
| Paper-Plugin | Ja (Server-Besitzer) | Server |
| Mineflayer-Bot | Nein (Bot-Account) | Du (Bot-Host) |

## API (Backend)

| Endpunkt | Beschreibung |
|----------|--------------|
| `POST /api/client/link/redeem` | Code + IGN |
| `POST /api/client/payment/confirm` | IGN + Betrag |
| `GET /api/config/payment` | Zahlungsempfänger laden |
