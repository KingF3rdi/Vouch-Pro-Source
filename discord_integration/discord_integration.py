"""
Discord Bot Integration Modul
=============================

Dieses Modul wird in deinen BESTEHENDEN Discord Bot eingebunden.
Es stellt Commands und Sync-Funktionen bereit, die mit der Shop-API kommunizieren.

Installation:
    pip install httpx

In deinem Bot (z.B. discord.py):
    from discord_integration import ShopIntegration

    shop = ShopIntegration(
        api_url="http://localhost:8000",
        api_key="dein-bot-api-key"
    )

    # In on_message oder als Slash Commands:
    await shop.handle_command(message)
"""

import httpx
import random
import string
from datetime import datetime


def format_ingame_price(value: float) -> str:
    n = float(value)
    if n >= 1e9:
        return f"{_trim(n / 1e9)}b"
    if n >= 1e6:
        return f"{_trim(n / 1e6)}m"
    if n >= 1e3:
        return f"{_trim(n / 1e3)}k"
    if n == int(n):
        return str(int(n))
    return _trim(n)


def _trim(num: float) -> str:
    return f"{num:.2f}".rstrip("0").rstrip(".")


class ShopIntegration:
    PREFIX = "!shop"

    def __init__(self, api_url: str, api_key: str):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.headers = {"X-Bot-Api-Key": api_key, "Content-Type": "application/json"}

    async def _request(self, method: str, path: str, json: dict = None):
        async with httpx.AsyncClient() as client:
            resp = await client.request(method, f"{self.api_url}{path}", headers=self.headers, json=json, timeout=15)
            if resp.status_code >= 400:
                return {"error": resp.json().get("detail", "API Fehler")}
            return resp.json()

    # ─── Produkt Commands ───────────────────────────────────────────

    async def post_product(self, name: str, price: float, preview_url: str = None,
                           discord_role_id: str = None, tags: str = "",
                           category_slug: str = None, description: str = "",
                           media_urls: list = None):
        """Produkt posten: Name, Vorschau, Preis, DC Rolle, Tags"""
        return await self._request("POST", "/api/bot/products", {
            "name": name,
            "price": price,
            "preview_url": preview_url,
            "discord_role_id": discord_role_id,
            "tags": tags,
            "category_slug": category_slug,
            "description": description,
            "media_urls": media_urls or [],
        })

    async def sync_sale(self, ign: str, amount: float, product_slug: str = None,
                        product_id: int = None, discord_id: str = None,
                        discount_code: str = None):
        """Verkauf vom Discord Bot synchronisieren"""
        return await self._request("POST", "/api/bot/sales/sync", {
            "ign": ign,
            "amount": amount,
            "product_slug": product_slug,
            "product_id": product_id,
            "discord_id": discord_id,
            "discount_code": discount_code,
        })

    async def sync_vouch(self, giver_name: str, message: str, is_positive: bool = True,
                         external_id: int = None):
        """Vouch zur Website synchronisieren"""
        return await self._request("POST", "/api/bot/vouches/sync", {
            "giver_name": giver_name,
            "message": message,
            "is_positive": is_positive,
            "external_id": external_id,
        })

    async def get_stats(self):
        """Shop-Statistiken abrufen"""
        return await self._request("GET", "/api/bot/stats")

    async def update_price(self, product_id: int, new_price: float):
        """Preis ändern und Wunschlisten-DM Empfänger zurückgeben"""
        return await self._request("POST", f"/api/bot/products/{product_id}/price", {
            "product_id": product_id,
            "old_price": 0,
            "new_price": new_price,
        })

    async def generate_link_code(self, code_type: str = "discord"):
        """Verknüpfungscode generieren (discord oder ign)"""
        return await self._request("POST", "/api/link/generate", {"code_type": code_type})

    # ─── Discord Command Handler ────────────────────────────────────

    async def handle_command(self, message) -> bool:
        """
        Verarbeitet Shop-Commands. Gibt True zurück wenn Command erkannt wurde.
        Commands:
            !shop post [name] | [preis] | [rolle_id] | [tags] | [preview_url]
            !shop stats
            !shop linkign [code] [ign]
            !shop syncvouch [name] | [nachricht]
            !shop price [product_id] [neuer_preis]
        """
        content = message.content.strip()
        if not content.lower().startswith(self.PREFIX):
            return False

        parts = content[len(self.PREFIX):].strip().split(maxsplit=1)
        if not parts:
            return True

        cmd = parts[0].lower()
        args = parts[1] if len(parts) > 1 else ""

        if cmd == "post" and message.author.guild_permissions.administrator:
            # Format: name | price | role_id | tags | preview_url
            segments = [s.strip() for s in args.split("|")]
            if len(segments) < 2:
                await message.channel.send("Format: `!shop post Name | Preis | RollenID | Tags | PreviewURL`")
                return True

            result = await self.post_product(
                name=segments[0],
                price=float(segments[1]),
                discord_role_id=segments[2] if len(segments) > 2 else None,
                tags=segments[3] if len(segments) > 3 else "",
                preview_url=segments[4] if len(segments) > 4 else None,
            )
            if "error" in result:
                await message.channel.send(f"Fehler: {result['error']}")
            else:
                await message.channel.send(f"Produkt **{result['name']}** gepostet! ({format_ingame_price(result['price'])})")
            return True

        elif cmd == "stats":
            stats = await self.get_stats()
            await message.channel.send(
                f"📊 **Shop Stats**\n"
                f"Verkäufe: **{stats['total_sales']}**\n"
                f"Umsatz: **{format_ingame_price(stats['total_revenue'])}**\n"
                f"Vouches: **{stats['total_vouches']}**"
            )
            return True

        elif cmd == "linkign":
            # !shop linkign CODE IGN
            link_parts = args.split()
            if len(link_parts) < 2:
                await message.channel.send("Format: `!shop linkign [Code] [IGN]`")
                return True

            result = await self._request("POST", "/api/link/redeem", {
                "code": link_parts[0].upper(),
                "ign": link_parts[1],
                "discord_id": str(message.author.id),
            })
            if "error" in result:
                await message.channel.send(f"Fehler: {result['error']}")
            else:
                await message.channel.send(f"✅ IGN **{link_parts[1]}** mit Discord verknüpft!")
            return True

        elif cmd == "syncvouch":
            segments = [s.strip() for s in args.split("|")]
            if len(segments) < 2:
                await message.channel.send("Format: `!shop syncvouch Name | Nachricht`")
                return True

            result = await self.sync_vouch(giver_name=segments[0], message=segments[1])
            if "error" in result:
                await message.channel.send(f"Fehler: {result['error']}")
            else:
                await message.channel.send("Vouch synchronisiert!")
            return True

        elif cmd == "price" and message.author.guild_permissions.administrator:
            price_parts = args.split()
            if len(price_parts) < 2:
                await message.channel.send("Format: `!shop price [product_id] [neuer_preis]`")
                return True

            product_id = int(price_parts[0])
            new_price = float(price_parts[1])
            result = await self.update_price(product_id, new_price)

            if "error" in result:
                await message.channel.send(f"Fehler: {result['error']}")
                return True

            # Wunschlisten-Benachrichtigungen per DM
            notify_ids = result.get("notify_discord_ids", [])
            for discord_id in notify_ids:
                try:
                    user = await message.guild.fetch_member(int(discord_id))
                    await user.send(
                        f"🔔 Preisänderung bei einem Wunschlisten-Item!\n"
                        f"Neuer Preis: **{format_ingame_price(new_price)}** (vorher {format_ingame_price(result['old_price'])})"
                    )
                except Exception:
                    pass

            await message.channel.send(f"Preis auf **{format_ingame_price(new_price)}** geändert. {len(notify_ids)} DMs gesendet.")
            return True

        elif cmd == "complete" and message.author.guild_permissions.administrator:
            order_parts = args.split()
            if not order_parts or not order_parts[0].isdigit():
                await message.channel.send("Format: `!shop complete [order_id]`")
                return True

            order_id = int(order_parts[0])
            result = await self._request("POST", f"/api/bot/orders/{order_id}/complete")
            if "error" in result:
                await message.channel.send(f"Fehler: {result['error']}")
            else:
                role_hint = ""
                if result.get("discord_role_id"):
                    role_hint = f" Rolle: `{result['discord_role_id']}`"
                await message.channel.send(
                    f"✅ Bestellung #{order_id} abgeschlossen — Produkt auf Profil freigeschaltet!{role_hint}"
                )
            return True

        elif cmd == "vouches":
            vouches = await self._request("GET", "/api/vouches")
            total = vouches.get("total", 0)
            examples = vouches.get("examples", [])
            text = f"**{total} Vouches insgesamt**\n\n"
            for v in examples[:3]:
                text += f"> **{v['giver_name']}**: {v['message']}\n"
            await message.channel.send(text)
            return True

        return True


# ─── Beispiel-Einbindung in discord.py Bot ──────────────────────────

INTEGRATION_EXAMPLE = '''
# In deinem bestehenden main.py:

from discord_integration import ShopIntegration

shop = ShopIntegration(
    api_url="http://deine-shop-api:8000",
    api_key="dein-geheimer-api-key"
)

class DiscordBot(discord.Client):
    async def on_message(self, message):
        if message.author == self.user:
            return

        # Shop Commands abfangen
        if await shop.handle_command(message):
            return

        # ... deine bestehenden Commands ...

    # Optional: Vouches automatisch syncen wenn approved
    async def on_vouch_approved(self, giver_name, vouch_message, vouch_id):
        await shop.sync_vouch(giver_name, vouch_message, True, vouch_id)
'''
