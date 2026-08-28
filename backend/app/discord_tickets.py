"""Discord Ticket-Erstellung über die REST API (bestehender Bot-Token)."""

import httpx

from app.config import settings
from app.format_price import format_ingame_price

DISCORD_API = "https://discord.com/api/v10"


async def create_purchase_ticket(
    order_id: int,
    discord_user_id: str,
    discord_username: str,
    ign: str,
    product_name: str,
    product_price: float,
    final_amount: float,
    discount_code: str | None,
    discount_percent: int,
) -> dict:
    if not settings.discord_bot_token or not settings.discord_guild_id:
        return {"success": False, "error": "Discord Bot nicht konfiguriert"}

    guild_id = settings.discord_guild_id
    headers = {
        "Authorization": f"Bot {settings.discord_bot_token}",
        "Content-Type": "application/json",
    }

    channel_name = f"ticket-{order_id}-{discord_username[:12].lower().replace(' ', '-')}"

    permission_overwrites = [
        {"id": guild_id, "type": 0, "deny": "1024"},
        {"id": discord_user_id, "type": 1, "allow": "3072"},
    ]

    payload = {
        "name": channel_name,
        "type": 0,
        "permission_overwrites": permission_overwrites,
    }
    if settings.discord_ticket_category_id:
        payload["parent_id"] = settings.discord_ticket_category_id

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{DISCORD_API}/guilds/{guild_id}/channels",
            headers=headers,
            json=payload,
            timeout=15,
        )
        if resp.status_code not in (200, 201):
            return {"success": False, "error": f"Channel erstellen fehlgeschlagen: {resp.text}"}

        channel = resp.json()
        channel_id = channel["id"]
        ticket_url = f"https://discord.com/channels/{guild_id}/{channel_id}"

        discount_line = "Kein Rabatt"
        if discount_code and discount_percent:
            discount_line = f"`{discount_code}` (-{discount_percent}%)"

        embed = {
            "title": f"🛒 TxTEmpire Bestellung #{order_id}",
            "color": 0xc026d3,
            "fields": [
                {"name": "Produkt", "value": product_name, "inline": True},
                {"name": "Originalpreis", "value": format_ingame_price(product_price), "inline": True},
                {"name": "Endpreis", "value": f"**{format_ingame_price(final_amount)}**", "inline": True},
                {"name": "Rabatt", "value": discount_line, "inline": True},
                {"name": "Minecraft IGN", "value": ign or "—", "inline": True},
                {"name": "Discord", "value": f"<@{discord_user_id}>", "inline": True},
                {
                    "name": "Zahlung",
                    "value": "Bitte schließe die Zahlung ab. Nach Bestätigung wird das Produkt auf deinem Profil freigeschaltet.",
                    "inline": False,
                },
            ],
            "footer": {"text": f"Order ID: {order_id} · TxTEmpire Shop"},
        }

        msg_resp = await client.post(
            f"{DISCORD_API}/channels/{channel_id}/messages",
            headers=headers,
            json={
                "content": f"<@{discord_user_id}> Willkommen in deinem Kauf-Ticket!",
                "embeds": [embed],
            },
            timeout=15,
        )
        if msg_resp.status_code not in (200, 201):
            return {
                "success": True,
                "channel_id": channel_id,
                "ticket_url": ticket_url,
                "warning": "Ticket erstellt, Embed konnte nicht gesendet werden",
            }

    return {"success": True, "channel_id": channel_id, "ticket_url": ticket_url}
