from __future__ import annotations

from typing import TYPE_CHECKING

import discord
from discord import app_commands
from discord.ext import commands

from integrations.shop_api import shop_api
from utils.embeds import error_embed, format_price, order_ref, success_embed

if TYPE_CHECKING:
    from bot import ShopBot


def _stars(rating: int) -> str:
    rating = max(1, min(5, int(rating)))
    return "★" * rating + "☆" * (5 - rating)


async def _post_local_vouch_embed(
    channel: discord.TextChannel,
    *,
    interaction: discord.Interaction,
    rating: int,
    message: str,
    order: dict,
) -> None:
    stars = _stars(rating)
    embed = discord.Embed(
        title="Neuer Vouch",
        description=message[:1500],
        color=0x2B6CB0,
    )
    embed.add_field(name="Bewertung", value=stars, inline=True)
    embed.add_field(name="Bestellung", value=order_ref(order), inline=True)
    embed.add_field(
        name="Betrag", value=format_price(float(order["total"])), inline=True
    )
    if order.get("ign"):
        embed.add_field(name="IGN", value=order["ign"], inline=True)
    embed.set_author(
        name=str(interaction.user),
        icon_url=interaction.user.display_avatar.url,
    )
    await channel.send(embed=embed)


async def _submit_website_vouch(
    interaction: discord.Interaction,
    rating: int,
    message: str,
) -> dict | None:
    if not shop_api.enabled:
        return None

    pending = await shop_api.fetch_pending_vouches(str(interaction.user.id))
    if not pending:
        return None

    order = pending[0]
    return await shop_api.submit_vouch(
        discord_id=str(interaction.user.id),
        order_id=int(order["order_id"]),
        rating=int(rating),
        message=message,
        giver_name=str(interaction.user),
    )


class VouchCog(commands.Cog):
    def __init__(self, bot: ShopBot) -> None:
        self.bot = bot

    @app_commands.command(
        name="vouch",
        description="Einmalig pro Kauf eine Bewertung hinterlassen (Server, DM oder Website)",
    )
    @app_commands.describe(
        rating="Bewertung 1–5 Sterne",
        message="Dein Vouch-Text",
    )
    async def vouch(
        self,
        interaction: discord.Interaction,
        rating: app_commands.Range[int, 1, 5],
        message: str,
    ) -> None:
        text = message.strip()
        if not text:
            await interaction.response.send_message(
                embed=error_embed("Leerer Text", "Bitte eine Nachricht eingeben."),
                ephemeral=True,
            )
            return

        # Discord-Ticket-Bestellungen (nur im Server)
        if interaction.guild is not None:
            order = await self.bot.db.get_unused_vouch_order(
                interaction.guild.id, interaction.user.id
            )
            if order:
                settings = await self.bot.db.ensure_guild(interaction.guild.id)
                channel_id = settings.get("vouch_channel_id")
                channel = (
                    interaction.guild.get_channel(int(channel_id)) if channel_id else None
                )
                if not isinstance(channel, discord.TextChannel):
                    await interaction.response.send_message(
                        embed=error_embed(
                            "Vouch-Channel fehlt",
                            "Admin muss `/setup` mit einem Vouch-Channel ausführen.",
                        ),
                        ephemeral=True,
                    )
                    return

                await self.bot.db.mark_vouch_used(int(order["id"]))
                await _post_local_vouch_embed(
                    channel,
                    interaction=interaction,
                    rating=int(rating),
                    message=text,
                    order=order,
                )

                if shop_api.enabled:
                    stars = _stars(int(rating))
                    await shop_api.sync_vouch(
                        giver_name=str(interaction.user),
                        message=f"{stars} — {text[:500]}",
                        is_positive=int(rating) >= 4,
                        external_id=int(order["id"]),
                    )

                await interaction.response.send_message(
                    embed=success_embed(
                        "Vouch gesendet",
                        f"Danke! Dein Vouch zu Bestellung {order_ref(order)} wurde gepostet.",
                    ),
                    ephemeral=True,
                )
                return

        # Website-Bestellungen (DM oder Server-Fallback)
        result = await _submit_website_vouch(interaction, int(rating), text)
        if not result:
            hint = (
                "Du brauchst einen bestätigten Kauf ohne bereits genutzten Vouch.\n\n"
                "Alternativ auf der Website: Profil → Vouch abgeben."
            )
            if not shop_api.enabled:
                hint = "Website-API ist nicht konfiguriert (SHOP_API_URL / BOT_API_KEY)."
            await interaction.response.send_message(
                embed=error_embed("Kein Vouch verfügbar", hint),
                ephemeral=True,
            )
            return

        product = result.get("product_name") or "dein Kauf"
        await interaction.response.send_message(
            embed=success_embed(
                "Vouch gesendet",
                f"Danke! Dein Vouch zu **{product}** (Bestellung #{result.get('order_id')}) "
                "wurde gespeichert und erscheint auf der Website.",
            ),
            ephemeral=True,
        )


async def setup(bot: ShopBot) -> None:
    await bot.add_cog(VouchCog(bot))
