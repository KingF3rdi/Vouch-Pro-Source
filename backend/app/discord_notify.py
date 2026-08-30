"""Discord-Benachrichtigungen: Kaufbestätigung, Tickets, DMs."""

import httpx

from app.config import settings
from app.format_price import format_ingame_price

DISCORD_API = "https://discord.com/api/v10"


def _headers() -> dict | None:
    if not settings.discord_bot_token:
        return None
    return {
        "Authorization": f"Bot {settings.discord_bot_token}",
        "Content-Type": "application/json",
    }


async def _post_message(channel_id: str, content: str = "", embed: dict | None = None) -> bool:
    headers = _headers()
    if not headers or not channel_id:
        return False
    payload = {}
    if content:
        payload["content"] = content
    if embed:
        payload["embeds"] = [embed]
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{DISCORD_API}/channels/{channel_id}/messages",
            headers=headers,
            json=payload,
            timeout=15,
        )
        return resp.status_code in (200, 201)


async def _dm_user(discord_user_id: str, content: str = "", embed: dict | None = None) -> bool:
    headers = _headers()
    if not headers or not discord_user_id:
        return False
    async with httpx.AsyncClient() as client:
        dm_resp = await client.post(
            f"{DISCORD_API}/users/@me/channels",
            headers=headers,
            json={"recipient_id": discord_user_id},
            timeout=15,
        )
        if dm_resp.status_code not in (200, 201):
            return False
        channel_id = dm_resp.json()["id"]
        return await _post_message(channel_id, content, embed)


def _confirmation_embed(
    order_id: int,
    product_name: str,
    amount: float,
    ign: str,
    discord_user_id: str | None,
    discount_code: str | None,
) -> dict:
    discount_line = f"`{discount_code}`" if discount_code else "Kein Rabatt"
    buyer = f"<@{discord_user_id}>" if discord_user_id else ign
    return {
        "title": "✅ TxTEmpire Kaufbestätigung",
        "description": f"**{product_name}** wurde erfolgreich freigeschaltet!",
        "color": 0x22c55e,
        "fields": [
            {"name": "Käufer", "value": buyer, "inline": True},
            {"name": "IGN", "value": ign or "—", "inline": True},
            {"name": "Betrag", "value": format_ingame_price(amount), "inline": True},
            {"name": "Rabatt", "value": discount_line, "inline": True},
            {"name": "Profil", "value": "Produkt ist jetzt auf deinem TxTEmpire Profil verfügbar.", "inline": False},
        ],
        "footer": {"text": f"Bestellung #{order_id} · TxTEmpire Shop"},
    }


async def post_purchase_confirmation(
    order_id: int,
    product_name: str,
    amount: float,
    ign: str,
    discord_user_id: str | None,
    discord_username: str | None,
    discount_code: str | None,
    ticket_channel_id: str | None,
) -> dict:
    """Postet Kaufbestätigung in Log-Channel, Ticket und per DM."""
    embed = _confirmation_embed(order_id, product_name, amount, ign, discord_user_id, discount_code)
    results = {"log": False, "ticket": False, "dm": False}

    if settings.discord_purchase_log_channel_id:
        results["log"] = await _post_message(
            settings.discord_purchase_log_channel_id,
            content="🎉 **Neuer Kauf bei TxTEmpire!**",
            embed=embed,
        )

    if ticket_channel_id:
        results["ticket"] = await _post_message(
            ticket_channel_id,
            content="✅ **Zahlung bestätigt — Vielen Dank für deinen Kauf!**",
            embed=embed,
        )

    if discord_user_id:
        results["dm"] = await _dm_user(
            discord_user_id,
            content="🎉 Dein Kauf bei TxTEmpire wurde bestätigt!",
            embed=embed,
        )

    return results


async def post_vouch_to_channel(
    *,
    giver_name: str,
    message: str,
    rating: int,
    order_id: int,
    product_name: str | None,
    amount: float,
    ign: str | None,
) -> bool:
    """Postet einen Vouch in den konfigurierten Discord-Vouch-Channel."""
    if not settings.discord_vouch_channel_id:
        return False

    stars = "★" * max(1, min(5, rating)) + "☆" * (5 - max(1, min(5, rating)))
    embed = {
        "title": "Neuer Vouch",
        "description": message[:1500],
        "color": 0x2B6CB0,
        "fields": [
            {"name": "Bewertung", "value": stars, "inline": True},
            {"name": "Bestellung", "value": f"#{order_id}", "inline": True},
            {"name": "Betrag", "value": format_ingame_price(amount), "inline": True},
        ],
        "footer": {"text": f"Von {giver_name} · TxTEmpire Shop"},
    }
    if product_name:
        embed["fields"].append({"name": "Produkt", "value": product_name, "inline": True})
    if ign:
        embed["fields"].append({"name": "IGN", "value": ign, "inline": True})

    return await _post_message(
        settings.discord_vouch_channel_id,
        content="⭐ **Neuer Vouch**",
        embed=embed,
    )


async def send_vouch_request_dm(
    discord_user_id: str,
    *,
    order_id: int,
    product_name: str,
    frontend_url: str | None = None,
) -> bool:
    """Sendet Vouch-Anfrage per DM nach bestätigtem Kauf."""
    base = (frontend_url or settings.frontend_url).rstrip("/")
    embed = {
        "title": "⭐ Vouch abgeben",
        "description": (
            f"Danke für deinen Kauf von **{product_name}**!\n\n"
            "Du kannst einmalig einen Vouch hinterlassen:"
        ),
        "color": 0x2B6CB0,
        "fields": [
            {
                "name": "Auf der Website",
                "value": f"[Profil öffnen]({base}/account) → Vouch-Formular",
                "inline": False,
            },
            {
                "name": "Per Discord-DM",
                "value": "Schreib mir hier: `/vouch rating:5 message:Dein Text`",
                "inline": False,
            },
            {
                "name": "Im Discord-Server",
                "value": "Alternativ `/vouch` im Shop-Server nutzen",
                "inline": False,
            },
        ],
        "footer": {"text": f"Bestellung #{order_id} · einmalig pro Kauf"},
    }
    return await _dm_user(
        discord_user_id,
        content="🙏 **Wie war dein Einkauf?** Hinterlasse gerne einen Vouch!",
        embed=embed,
    )


async def notify_vouch_submitted(
    *,
    giver_name: str,
    message: str,
    rating: int,
    order_id: int,
    product_name: str | None,
    amount: float,
    ign: str | None,
) -> None:
    await post_vouch_to_channel(
        giver_name=giver_name,
        message=message,
        rating=rating,
        order_id=order_id,
        product_name=product_name,
        amount=amount,
        ign=ign,
    )


# Re-export ticket creation from discord_tickets for backwards compatibility
from app.discord_tickets import create_purchase_ticket  # noqa: E402
