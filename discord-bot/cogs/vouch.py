from __future__ import annotations

from typing import TYPE_CHECKING

import discord
from discord import app_commands
from discord.ext import commands

from utils.embeds import error_embed, format_price, order_ref, success_embed

if TYPE_CHECKING:
    from bot import ShopBot


class VouchCog(commands.Cog):
    def __init__(self, bot: ShopBot) -> None:
        self.bot = bot

    @app_commands.command(
        name="vouch",
        description="Einmalig pro Kauf eine Bewertung hinterlassen",
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
        assert interaction.guild is not None
        settings = await self.bot.db.ensure_guild(interaction.guild.id)
        order = await self.bot.db.get_unused_vouch_order(
            interaction.guild.id, interaction.user.id
        )
        if not order:
            await interaction.response.send_message(
                embed=error_embed(
                    "Kein Vouch verfügbar",
                    "Du brauchst einen bestätigten Kauf ohne bereits genutzten Vouch.",
                ),
                ephemeral=True,
            )
            return

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

        stars = "★" * int(rating) + "☆" * (5 - int(rating))
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

        from integrations.shop_api import shop_api

        if shop_api.enabled:
            await shop_api.sync_vouch(
                giver_name=str(interaction.user),
                message=f"{stars} — {message[:500]}",
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


async def setup(bot: ShopBot) -> None:
    await bot.add_cog(VouchCog(bot))
