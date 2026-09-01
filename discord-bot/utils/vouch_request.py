"""Vouch-Anfrage per DM nach abgeschlossenem Kauf."""

from __future__ import annotations

import discord

import config
from integrations.shop_api import shop_api


async def send_vouch_request_dm(
    bot: discord.Client,
    user: discord.abc.User,
    *,
    order_ref_text: str,
    product_hint: str = "dein Kauf",
) -> bool:
    embed = discord.Embed(
        title="⭐ Vouch abgeben",
        description=(
            f"Danke für **{product_hint}** ({order_ref_text})!\n\n"
            "Du kannst einmalig einen Vouch hinterlassen:"
        ),
        color=config.EMBED_COLOR,
    )
    embed.add_field(
        name="Per DM (hier)",
        value="`/vouch rating:5 message:Dein Text`",
        inline=False,
    )
    embed.add_field(
        name="Im Discord-Server",
        value="Gleicher Befehl `/vouch` im Server-Channel",
        inline=False,
    )
    if shop_api.enabled:
        frontend = (config.FRONTEND_URL or "http://localhost:3000").rstrip("/")
        embed.add_field(
            name="Auf der Website",
            value=f"[Profil öffnen]({frontend}/account)",
            inline=False,
        )
    embed.set_footer(text="Einmalig pro Kauf · TxTEmpire Shop")

    try:
        await user.send(
            content="🙏 **Wie war dein Einkauf?** Hinterlasse gerne einen Vouch!",
            embed=embed,
        )
        return True
    except discord.HTTPException:
        return False
